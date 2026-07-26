// payment-service.js
// Serviço unificado de pagamentos — versão com backend real

var PaymentService = {

    // ==========================================
    // STRIPE
    // ==========================================
    createStripeSession: async function(orderData) {
        try {
            var callable = firebase.functions().httpsCallable('createStripeCheckout');
            var result = await callable({
                orderId: orderData.id,
                items: orderData.items,
                customerEmail: orderData.customer.email,
                customerName: orderData.customer.name,
                shippingCost: orderData.totals.shipping || 0
            });

            if (result.data && result.data.url) {
                window.location.href = result.data.url;
                return 'redirecting';
            }
            throw new Error('Sem URL de checkout');
        } catch (error) {
            console.error('[Stripe] Erro:', error);
            return { error: error.message };
        }
    },

    // ==========================================
    // MULTICAIXA EXPRESS
    // ==========================================

    // Gerar referência de pagamento
    createMulticaixaPayment: async function(orderData) {
        try {
            var callable = firebase.functions().httpsCallable('createMulticaixaPayment');
            var result = await callable({
                orderId: orderData.id,
                amount: orderData.totals.total
            });

            if (result.data && result.data.success) {
                return {
                    success: true,
                    reference: result.data.reference,
                    amount: result.data.amount,
                    entityCode: result.data.entityCode,
                    deeplink: result.data.deeplink
                };
            }

            throw new Error(result.data?.error || 'Erro ao gerar referência');

        } catch (error) {
            console.error('[Multicaixa] Erro:', error);

            // Verificar se é erro de configuração
            if (error.message && error.message.indexOf('não configurado') !== -1) {
                return {
                    success: false,
                    error: 'not_configured',
                    message: 'Multicaixa Express ainda não está configurado. Usa outro método de pagamento ou contacta o suporte.'
                };
            }

            return { success: false, error: error.message };
        }
    },

    // Polling: verificar se o pagamento foi confirmado
    pollMulticaixaPayment: function(reference, onConfirmed, onExpired, onError) {
        var attempts = 0;
        var maxAttempts = 120; // 120 * 3s = 6 minutos máximo
        var interval = 3000; // 3 segundos

        var poll = async function() {
            attempts++;

            if (attempts > maxAttempts) {
                // Timeout — marcar como expirado
                try {
                    var expireFn = firebase.functions().httpsCallable('cancelMulticaixaPayment');
                    await expireFn({ reference: reference });
                } catch (e) { /* ignorar */ }

                if (onExpired) onExpired();
                return;
            }

            try {
                var checkFn = firebase.functions().httpsCallable('checkMulticaixaPayment');
                var result = await checkFn({ reference: reference });

                if (result.data.status === 'paid') {
                    if (onConfirmed) onConfirmed(result.data);
                    return;
                }

                if (result.data.status === 'expired' || result.data.status === 'cancelled') {
                    if (onExpired) onExpired();
                    return;
                }

                // Ainda pendente — continuar polling
                setTimeout(poll, interval);

            } catch (error) {
                console.error('[Multicaixa] Erro no polling:', error);
                if (onError) onError(error);
            }
        };

        // Iniciar polling após 2 segundos (dar tempo ao cliente abrir o app)
        setTimeout(poll, 2000);
    },

    // ==========================================
    // PAGAMENTO NA ENTREGA
    // ==========================================
    processCashOnDelivery: function(orderData) {
        return Promise.resolve({
            status: 'pending',
            method: 'cod',
            message: 'Pagamento será recolhido na entrega'
        });
    },

    // ==========================================
    // TRANSFERÊNCIA BANCÁRIA
    // ==========================================
    processBankTransfer: function(orderData) {
        return Promise.resolve({
            status: 'pending',
            method: 'transfer',
            message: 'Aguardando confirmação de transferência'
        });
    },

    // ==========================================
    // MÉTODO PRINCIPAL
    // ==========================================
    processPayment: async function(orderData) {
        switch (orderData.payment) {
            case 'multicaixa':
                return await this.createMulticaixaPayment(orderData);
            case 'cod':
                return await this.processCashOnDelivery(orderData);
            case 'transfer':
                return await this.processBankTransfer(orderData);
            case 'stripe':
                return await this.createStripeSession(orderData);
            default:
                return { error: 'Método não reconhecido' };
        }
    },

    // ==========================================
    // UTILITÁRIOS
    // ==========================================
    getLabel: function(method) {
        var labels = {
            'multicaixa': 'Multicaixa Express',
            'stripe': 'Cartão Internacional',
            'cod': 'Pagamento na Entrega',
            'transfer': 'Transferência Bancária'
        };
        return labels[method] || method;
    },

    isOnlinePayment: function(method) {
        return method === 'multicaixa' || method === 'stripe';
    },

    formatAmount: function(amount) {
        if (typeof amount !== 'number') return amount || '-';
        return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Kz';
    }
};