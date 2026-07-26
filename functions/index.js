// functions/index.js
// Cloud Functions da AODA Store
// Multicaixa Express + SendGrid + Stripe + Webhooks

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const sgMail = require('@sendgrid/mail');
const CryptoJS = require('crypto-js');

// =============================================
// RATE LIMITING (memória in-memory por instância)
// =============================================

const rateLimitMap = new Map();

function rateLimit(key, maxRequests, windowMs) {
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now - entry.startTime > windowMs) {
        rateLimitMap.set(key, { count: 1, startTime: now });
        return false; // permitido
    }

    entry.count++;
    if (entry.count > maxRequests) {
        return true; // bloqueado
    }
    return false; // permitido
}

// Middleware de rate limiting para onRequest functions
function rateLimitMiddleware(maxRequests, windowMs) {
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        if (rateLimit(ip, maxRequests, windowMs)) {
            return res.status(429).json({ error: 'Muitas requisições. Tenta novamente mais tarde.' });
        }
        next();
    };
}

// =============================================
// VALIDAÇÃO DE DADOS
// =============================================

function validateString(value, fieldName, maxLength) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new functions.https.HttpsError('invalid-argument', `${fieldName} é obrigatório e deve ser texto`);
    }
    if (maxLength && value.length > maxLength) {
        throw new functions.https.HttpsError('invalid-argument', `${fieldName} não pode exceder ${maxLength} caracteres`);
    }
    return value.trim();
}

function validatePositiveNumber(value, fieldName) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
        throw new functions.https.HttpsError('invalid-argument', `${fieldName} deve ser um número positivo`);
    }
    return num;
}

function validateEmail(value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof value !== 'string' || !emailRegex.test(value)) {
        throw new functions.https.HttpsError('invalid-argument', 'Endereço de e-mail inválido');
    }
    return value.trim().toLowerCase();
}

function validateOrderItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'A encomenda deve conter pelo menos um item');
    }

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        validateString(item.name, `Item ${i + 1}: nome`, 200);
        validatePositiveNumber(item.price, `Item ${i + 1}: preço`);

        if (item.qty !== undefined) {
            const qty = Number(item.qty);
            if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
                throw new functions.https.HttpsError('invalid-argument', `Item ${i + 1}: quantidade deve ser entre 1 e 100`);
            }
        }
    }

    return items;
}

// =============================================
// CONFIGURAÇÃO
// Configura estas variáveis com `firebase functions:secrets:set`
// =============================================

// SendGrid: firebase functions:secrets:set SENDGRID_API_KEY="SG.xxxxx"
let sendgridInitialized = false;
function getSendGrid() {
    if (!sendgridInitialized) {
        const key = process.env.SENDGRID_API_KEY;
        if (key) {
            sgMail.setApiKey(key);
            sendgridInitialized = true;
        }
    }
    return sendgridInitialized;
}

// Multicaixa Express: firebase functions:secrets:set MULTICAIXA_TOKEN="xxxx"
// firebase functions:secrets:set MULTICAIXA_ENTITY="00100"
// firebase functions:secrets:set MULTICAIXA_HMAC_KEY="xxxx"
const MULTICAIXA_CONFIG = {
    token: process.env.MULTICAIXA_TOKEN || '',
    entityCode: process.env.MULTICAIXA_ENTITY || '00100',
    hmacKey: process.env.MULTICAIXA_HMAC_KEY || ''
};

// Stripe (se usares): firebase functions:secrets:set STRIPE_SECRET_KEY="sk_test_xxx"
// NOTA: Stripe não suporta Kwanza Angolano (AOA).
// A moeda usada no checkout é USD com conversão implícita.
// Fator de conversão AOA → USD (ex: 1 USD = 830 AOA).
// Configura com: firebase functions:secrets:set STRIPE_AOA_TO_USD_RATE="0.0012"
let stripeClient = null;
function getStripe() {
    if (!stripeClient) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (key) {
            stripeClient = require('stripe')(key);
        }
    }
    return stripeClient;
}

function getConversionRate() {
    return Number(process.env.STRIPE_AOA_TO_USD_RATE) || 0.0012;
}


// =============================================
// 1. MULTICAIXA EXPRESS
// =============================================

// Gerar referência de pagamento com assinatura HMAC
exports.createMulticaixaPayment = functions.https.onCall(async (data, context) => {
    // Rate limiting
    const callerUid = context.auth ? context.auth.uid : (data.orderId || 'anon');
    if (rateLimit(`mc_create:${callerUid}`, 5, 60000)) {
        throw new functions.https.HttpsError('resource-exhausted', 'Muitas requisições. Tenta novamente dentro de um minuto.');
    }

    if (!MULTICAIXA_CONFIG.token || !MULTICAIXA_CONFIG.hmacKey) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Multicaixa Express não configurado. Define MULTICAIXA_TOKEN e MULTICAIXA_HMAC_KEY como secrets.'
        );
    }

    // Validação de dados (#7)
    validateString(data.orderId, 'orderId', 100);
    const amount = validatePositiveNumber(data.amount, 'amount');

    try {
        // Gerar referência única
        const reference = data.orderId + '-' + Date.now().toString(36).toUpperCase();

        // Assinar com HMAC-SHA256
        // Formato exigido pela EMIS: HMAC(token + reference + amount + entityCode, hmacKey)
        const message = MULTICAIXA_CONFIG.token + reference + amount + MULTICAIXA_CONFIG.entityCode;
        const hmac = CryptoJS.HmacSHA256(message, MULTICAIXA_CONFIG.hmacKey).toString();

        // Guardar pagamento pendente no Firestore
        await admin.firestore().collection('payments').doc(reference).set({
            orderId: data.orderId,
            reference: reference,
            amount: amount,
            currency: 'AOA',
            entityCode: MULTICAIXA_CONFIG.entityCode,
            hmac: hmac,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Atualizar encomenda
        const orderSnapshot = await admin.firestore()
            .collection('orders')
            .where('id', '==', data.orderId)
            .get();

        if (!orderSnapshot.empty) {
            await orderSnapshot.docs[0].ref.update({
                paymentReference: reference,
                paymentStatus: 'awaiting_payment'
            });
        }

        console.log(`[Multicaixa] Referência gerada: ${reference} para pedido ${data.orderId}`);

        return {
            success: true,
            reference: reference,
            amount: amount,
            entityCode: MULTICAIXA_CONFIG.entityCode,
            // Link para abrir diretamente no app Multicaixa Express
            deeplink: `multicaixaexpress://payment?ref=${reference}&entity=${MULTICAIXA_CONFIG.entityCode}&amount=${amount}`
        };

    } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        console.error('[Multicaixa] Erro:', error);
        throw new functions.https.HttpsError('internal', 'Erro ao gerar referência de pagamento');
    }
});

// Verificar estado do pagamento Multicaixa (polling do frontend)
exports.checkMulticaixaPayment = functions.https.onCall(async (data, context) => {
    // Rate limiting: 20 checks por minuto
    const callerUid = context.auth ? context.auth.uid : (data.reference || 'anon');
    if (rateLimit(`mc_check:${callerUid}`, 20, 60000)) {
        throw new functions.https.HttpsError('resource-exhausted', 'Muitas verificações. Aguarda alguns segundos.');
    }

    validateString(data.reference, 'reference', 200);

    try {
        const doc = await admin.firestore().collection('payments').doc(data.reference).get();

        if (!doc.exists) {
            return { status: 'not_found' };
        }

        const payment = doc.data();
        return {
            status: payment.status, // pending, paid, expired, cancelled
            amount: payment.amount,
            paidAt: payment.paidAt ? payment.paidAt.toDate().toISOString() : null
        };

    } catch (error) {
        console.error('[Multicaixa] Erro ao verificar:', error);
        return { status: 'error' };
    }
});

// Webhook recebido pela EMIS quando o pagamento é confirmado
// Fix #8: CORS configurado explicitamente
exports.multicaixaWebhook = functions.https.onRequest(
    rateLimitMiddleware(30, 60000),
    async (req, res) => {
        // CORS
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, X-Signature');

        if (req.method === 'OPTIONS') {
            return res.status(204).send('');
        }

        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Método não permitido' });
        }

        try {
            const body = req.body;
            console.log('[Multicaixa Webhook] Recebido:', JSON.stringify(body));

            // A EMIS envia a referência do pagamento confirmado
            const reference = body.reference || body.paymentReference;

            if (!reference) {
                return res.status(400).json({ error: 'Referência não fornecida' });
            }

            // Verificar HMAC se a EMIS enviar assinatura
            if (body.signature && MULTICAIXA_CONFIG.hmacKey) {
                const expectedSig = CryptoJS.HmacSHA256(
                    MULTICAIXA_CONFIG.token + reference,
                    MULTICAIXA_CONFIG.hmacKey
                ).toString();

                if (body.signature !== expectedSig) {
                    console.warn('[Multicaixa] Assinatura inválida para referência:', reference);
                    return res.status(401).json({ error: 'Assinatura inválida' });
                }
            }

            // Atualizar pagamento como pago
            await admin.firestore().collection('payments').doc(reference).update({
                status: 'paid',
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
                webhookData: body
            });

            // Atualizar encomenda
            const paymentDoc = await admin.firestore().collection('payments').doc(reference).get();
            if (paymentDoc.exists) {
                const orderId = paymentDoc.data().orderId;
                const orderSnapshot = await admin.firestore()
                    .collection('orders')
                    .where('id', '==', orderId)
                    .get();

                if (!orderSnapshot.empty) {
                    await orderSnapshot.docs[0].ref.update({
                        status: 'processing',
                        paymentStatus: 'paid',
                        paidAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    console.log(`[Multicaixa] Encomenda ${orderId} marcada como paga`);
                }
            }

            return res.status(200).json({ success: true, reference: reference });

        } catch (error) {
            console.error('[Multicaixa Webhook] Erro:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }
);

// Cancelar pagamento Multicaixa expirado
exports.cancelMulticaixaPayment = functions.https.onCall(async (data, context) => {
    validateString(data.reference, 'reference', 200);

    await admin.firestore().collection('payments').doc(data.reference).update({
        status: 'expired'
    });

    const paymentDoc = await admin.firestore().collection('payments').doc(data.reference).get();
    if (paymentDoc.exists) {
        const orderId = paymentDoc.data().orderId;
        const orderSnapshot = await admin.firestore()
            .collection('orders').where('id', '==', orderId).get();
        if (!orderSnapshot.empty) {
            await orderSnapshot.docs[0].ref.update({ status: 'cancelled' });
        }
    }

    return { success: true };
});


// =============================================
// 2. SENDGRID — E-MAILS TRANSACIONAIS
// =============================================

// Enviar e-mail de confirmação de encomenda
exports.sendOrderEmail = functions.https.onCall(async (data, context) => {
    // Rate limiting
    const callerUid = context.auth ? context.auth.uid : 'anon';
    if (rateLimit(`email:${callerUid}`, 5, 60000)) {
        throw new functions.https.HttpsError('resource-exhausted', 'Muitas requisições de e-mail.');
    }

    if (!getSendGrid()) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'SendGrid não configurado. Define SENDGRID_API_KEY como secret.'
        );
    }

    // Validação (#7)
    const toEmail = validateEmail(data.toEmail);
    validateString(data.subject, 'subject', 200);
    validateString(data.html, 'html', 500000);

    try {
        const msg = {
            to: toEmail,
            from: 'AODA Store <noreply@aodastore.co.ao>',
            subject: data.subject,
            html: data.html
        };

        await sgMail.send(msg);
        console.log(`[SendGrid] E-mail enviado para: ${toEmail}`);
        return { success: true };

    } catch (error) {
        console.error('[SendGrid] Erro:', error);
        throw new functions.https.HttpsError('internal', 'Erro ao enviar e-mail');
    }
});

// Enviar notificação ao admin
exports.sendAdminNotification = functions.https.onCall(async (data, context) => {
    if (!getSendGrid()) return { success: true, skipped: true };

    try {
        const msg = {
            to: 'contacto@aodastore.co.ao',
            from: 'AODA Store <noreply@aodastore.co.ao>',
            subject: data.subject || 'Notificação AODA Store',
            html: data.html || ''
        };
        await sgMail.send(msg);
        return { success: true };
    } catch (error) {
        console.error('[SendGrid] Erro notificação admin:', error);
        return { success: true, error: error.message };
    }
});


// =============================================
// 3. STRIPE (se utilizado)
// NOTA (#9): Stripe não suporta Kwanza Angolano (AOA).
// Os valores são convertidos de AOA para USD (cents) automaticamente.
// Configura a taxa de conversão com: firebase functions:secrets:set STRIPE_AOA_TO_USD_RATE="0.0012"
// =============================================

exports.createStripeCheckout = functions.https.onCall(async (data, context) => {
    // Rate limiting
    const callerUid = context.auth ? context.auth.uid : (data.orderId || 'anon');
    if (rateLimit(`stripe:${callerUid}`, 5, 60000)) {
        throw new functions.https.HttpsError('resource-exhausted', 'Muitas tentativas de checkout.');
    }

    const stripe = getStripe();
    if (!stripe) {
        throw new functions.https.HttpsError('failed-precondition', 'Stripe não configurado');
    }

    // Validação (#7)
    validateString(data.orderId, 'orderId', 100);
    validateOrderItems(data.items);

    if (data.shippingCost !== undefined) {
        const shippingCost = Number(data.shippingCost);
        if (shippingCost < 0) {
            throw new functions.https.HttpsError('invalid-argument', 'Custo de envio não pode ser negativo');
        }
    }

    const conversionRate = getConversionRate();

    try {
        // Converter valores de AOA para USD cents para o Stripe
        const lineItems = data.items.map(item => ({
            price_data: {
                currency: 'usd', // Stripe não suporta AOA — usar USD com conversão
                product_data: {
                    name: `${item.name} - ${item.color} (${item.size})`,
                    images: item.image && item.image.startsWith('http')
                        ? [item.image]
                        : [`https://aodastore.co.ao/${item.image}`]
                },
                // Converter AOA para USD cents (Stripe usa centavos)
                unit_amount: Math.round(Math.max(0, item.price) * conversionRate * 100)
            },
            quantity: item.qty
        }));

        if (data.shippingCost > 0) {
            lineItems.push({
                price_data: {
                    currency: 'usd',
                    product_data: { name: 'Envio' },
                    unit_amount: Math.round(data.shippingCost * conversionRate * 100)
                },
                quantity: 1
            });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `https://aodastore.co.ao/checkout-success.html?session_id={CHECKOUT_SESSION_ID}&order=${data.orderId}`,
            cancel_url: `https://aodastore.co.ao/cart.html?cancelled=true`,
            customer_email: data.customerEmail || undefined,
            metadata: { orderId: data.orderId, customerName: data.customerName || '', originalCurrency: 'AOA' }
        });

        const snapshot = await admin.firestore().collection('orders').where('id', '==', data.orderId).get();
        if (!snapshot.empty) {
            await snapshot.docs[0].ref.update({
                stripeSessionId: session.id,
                paymentStatus: 'awaiting_payment'
            });
        }

        return { url: session.url, sessionId: session.id, conversionRate: conversionRate };

    } catch (error) {
        console.error('[Stripe] Erro:', error);
        throw new functions.https.HttpsError('internal', 'Erro ao criar sessão Stripe');
    }
});

exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const stripe = getStripe();
    if (!stripe) return res.status(503).send('Stripe não configurado');

    // CORS para webhooks (#8)
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const orderId = session.metadata.orderId;
        if (orderId) {
            const snapshot = await admin.firestore().collection('orders').where('id', '==', orderId).get();
            if (!snapshot.empty) {
                await snapshot.docs[0].ref.update({
                    status: 'processing',
                    paymentStatus: 'paid',
                    paidAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        }
    }

    res.json({ received: true });
});

exports.verifyStripePayment = functions.https.onCall(async (data, context) => {
    const stripe = getStripe();
    if (!stripe) return { paid: false, error: 'Stripe não configurado' };

    validateString(data.sessionId, 'sessionId', 200);

    try {
        const session = await stripe.checkout.sessions.retrieve(data.sessionId);
        return { paid: session.payment_status === 'paid', amount_total: session.amount_total };
    } catch (error) {
        return { paid: false, error: error.message };
    }
});


// =============================================
// 4. UTILITÁRIOS
// =============================================

// Limpar pagamentos expirados (executar a cada hora)
exports.cleanupExpiredPayments = functions.pubsub
    .schedule('every 60 minutes')
    .onRun(async (context) => {
        const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutos

        const snapshot = await admin.firestore()
            .collection('payments')
            .where('status', '==', 'pending')
            .where('createdAt', '<', cutoff)
            .get();

        const batch = admin.firestore().batch();
        let count = 0;

        for (const doc of snapshot.docs) {
            batch.update(doc.ref, { status: 'expired' });

            // Também cancelar a encomenda associada
            const orderId = doc.data().orderId;
            if (orderId) {
                const orderSnapshot = await admin.firestore()
                    .collection('orders')
                    .where('id', '==', orderId)
                    .get();
                if (!orderSnapshot.empty && orderSnapshot.docs[0].data().status === 'pending') {
                    batch.update(orderSnapshot.docs[0].ref, { status: 'cancelled' });
                }
            }
            count++;
        }

        if (count > 0) {
            await batch.commit();
            console.log(`[Cleanup] ${count} pagamentos expirados cancelados`);
        }
    });