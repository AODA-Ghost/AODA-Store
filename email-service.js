// email-service.js
// Serviço de e-mails via SendGrid (Cloud Functions)
// A API key do SendGrid fica segura no servidor — nunca no browser

var EmailService = {

    // Inicialização (mantido por compatibilidade com chamadas EmailService.init())
    // O envio real acontece via Cloud Functions + SendGrid, não há SDK client-side a inicializar.
    init: function() {
        console.log('[Email] Serviço pronto (SendGrid via Cloud Functions)');
    },

    // ==========================================
    // SANITIZAÇÃO — prevenir XSS em templates HTML
    // ==========================================

    // Escapar caracteres HTML especiais
    escapeHTML: function(str) {
        if (typeof str !== 'string') return String(str || '');
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    // Gerar HTML do e-mail de confirmação
    generateOrderHTML: function(orderData) {
        var self = this;
        var customerName = this.escapeHTML(orderData.customer.name.split(' ')[0]);

        var itemsHTML = '';
        if (orderData.items && orderData.items.length > 0) {
            itemsHTML = orderData.items.map(function(item) {
                return '<tr>' +
                    '<td style="padding:10px 0;border-bottom:1px solid #eee;">' + self.escapeHTML(item.name) + '</td>' +
                    '<td style="padding:10px 0;border-bottom:1px solid #eee;">' + self.escapeHTML(item.color) + '</td>' +
                    '<td style="padding:10px 0;border-bottom:1px solid #eee;">' + self.escapeHTML(item.size) + '</td>' +
                    '<td style="padding:10px 0;border-bottom:1px solid #eee;text-align:center;">' + self.escapeHTML(item.qty) + '</td>' +
                    '<td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600;">' + self.formatKz(item.price) + '</td>' +
                '</tr>';
            }).join('');
        }

        var shippingLabels = {
            'standard': 'Entrega Standard (2-5 dias)',
            'express': 'Entrega Express (24-48h)',
            'pickup': 'Levantar na Loja'
        };
        var paymentLabels = {
            'multicaixa': 'Multicaixa Express',
            'stripe': 'Cartão Internacional',
            'cod': 'Pagamento na Entrega',
            'transfer': 'Transferência Bancária'
        };

        // Sanitizar dados do cliente e endereço
        var safeOrderId = this.escapeHTML(orderData.id);
        var safeCustomerName = this.escapeHTML(orderData.customer.name);
        var safeCustomerPhone = this.escapeHTML(orderData.customer.phone);
        var safeStreet = this.escapeHTML(orderData.address.street);
        var safeNumber = this.escapeHTML(orderData.address.number);
        var safeNeighborhood = this.escapeHTML(orderData.address.neighborhood);
        var safeMunicipality = this.escapeHTML(orderData.address.municipality);
        var safeProvince = this.escapeHTML(orderData.address.province);
        var safePaymentLabel = this.escapeHTML(paymentLabels[orderData.payment] || orderData.payment);
        var safeShippingLabel = this.escapeHTML(shippingLabels[orderData.shipping] || orderData.shipping);

        return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>' +
            '<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">' +
            '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:white;">' +

            // Header
            '<tr><td style="background:#2C2C2C;padding:30px 40px;text-align:center;">' +
                '<h1 style="color:white;margin:0;font-size:28px;font-weight:300;">AODA Store</h1>' +
                '<p style="color:#A8B5A0;margin:5px 0 0;font-size:14px;">Confirmação de Encomenda</p>' +
            '</td></tr>' +

            // Mensagem
            '<tr><td style="padding:30px 40px 10px;">' +
                '<p style="font-size:16px;color:#2C2C2C;">Olá <strong>' + customerName + '</strong>,</p>' +
                '<p style="font-size:14px;color:#666;">Obrigado pela tua compra na AODA Store! Abaixo encontras os detalhes do teu pedido.</p>' +
            '</td></tr>' +

            // Dados do pedido
            '<tr><td style="padding:20px 40px;">' +
                '<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;border-radius:8px;overflow:hidden;">' +
                '<tr><td style="padding:12px 16px;color:#888;font-size:12px;width:40%;">N.º Pedido</td><td style="padding:12px 16px;font-weight:600;font-size:14px;">' + safeOrderId + '</td></tr>' +
                '<tr><td style="padding:12px 16px;color:#888;font-size:12px;">Data</td><td style="padding:12px 16px;font-size:14px;">' + new Date().toLocaleDateString('pt-AO', {day:'2-digit',month:'long',year:'numeric'}) + '</td></tr>' +
                '<tr><td style="padding:12px 16px;color:#888;font-size:12px;">Pagamento</td><td style="padding:12px 16px;font-size:14px;">' + safePaymentLabel + '</td></tr>' +
                '<tr><td style="padding:12px 16px;color:#888;font-size:12px;">Entrega</td><td style="padding:12px 16px;font-size:14px;">' + safeShippingLabel + '</td></tr>' +
                '</table>' +
            '</td></tr>' +

            // Morada
            '<tr><td style="padding:20px 40px 10px;">' +
                '<p style="font-size:13px;color:#888;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Endereço de Entrega</p>' +
                '<p style="font-size:14px;color:#2C2C2C;line-height:1.6;">' +
                    safeCustomerName + '<br>' +
                    safeStreet + ', ' + safeNumber + '<br>' +
                    safeNeighborhood + '<br>' +
                    safeMunicipality + ' - ' + safeProvince + '<br>' +
                    '<span style="color:#888;">Tel: ' + safeCustomerPhone + '</span>' +
                '</p>' +
            '</td></tr>' +

            // Items
            '<tr><td style="padding:20px 40px;">' +
                '<p style="font-size:13px;color:#888;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">Itens do Pedido</p>' +
                '<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">' +
                '<tr style="border-bottom:2px solid #2C2C2C;">' +
                    '<th style="padding:8px 0;text-align:left;font-size:12px;color:#888;">Produto</th>' +
                    '<th style="padding:8px 0;text-align:left;font-size:12px;color:#888;">Cor</th>' +
                    '<th style="padding:8px 0;text-align:left;font-size:12px;color:#888;">Tamanho</th>' +
                    '<th style="padding:8px 0;text-align:center;font-size:12px;color:#888;">Qtd</th>' +
                    '<th style="padding:8px 0;text-align:right;font-size:12px;color:#888;">Preço</th>' +
                '</tr>' +
                itemsHTML +
                '</table>' +
            '</td></tr>' +

            // Total
            '<tr><td style="padding:10px 40px 30px;text-align:right;">' +
                '<p style="font-size:18px;font-weight:700;color:#2C2C2C;margin:0;">Total: ' + self.formatKz(orderData.totals.total) + '</p>' +
                (orderData.totals.discount > 0 ? '<p style="font-size:12px;color:#A8B5A0;margin:4px 0 0;">Desconto aplicado: -' + self.formatKz(orderData.totals.discount) + '</p>' : '') +
                (orderData.totals.shipping === 0 ? '<p style="font-size:12px;color:#A8B5A0;margin:4px 0 0;">Envio: GRÁTIS</p>' : '') +
            '</td></tr>' +

            // Footer
            '<tr><td style="background:#F5F1E8;padding:25px 40px;text-align:center;">' +
                '<p style="font-size:13px;color:#666;margin:0;">Para questões sobre a tua encomenda, responde a este e-mail ou contacta-nos pelo WhatsApp.</p>' +
                '<p style="font-size:12px;color:#999;margin:8px 0 0;">AODA Store &middot; Luanda, Angola</p>' +
            '</td></tr>' +

            '</table></body></html>';
    },

    // Gerar HTML simplificado para notificação do admin
    generateAdminHTML: function(orderData) {
        var self = this;
        var itemsList = (orderData.items || []).map(function(i) {
            return self.escapeHTML(i.qty) + 'x ' + self.escapeHTML(i.name) +
                ' (' + self.escapeHTML(i.color) + '/' + self.escapeHTML(i.size) + ') — ' + self.formatKz(i.price);
        }).join('<br>');

        return '<h2>Nova Encomenda: ' + this.escapeHTML(orderData.id) + '</h2>' +
            '<p><strong>Cliente:</strong> ' + this.escapeHTML(orderData.customer.name) + '</p>' +
            '<p><strong>Telefone:</strong> ' + this.escapeHTML(orderData.customer.phone) + '</p>' +
            '<p><strong>Morada:</strong> ' + this.escapeHTML(orderData.address.street) +
                ', ' + this.escapeHTML(orderData.address.neighborhood) +
                ', ' + this.escapeHTML(orderData.address.municipality) +
                ' - ' + this.escapeHTML(orderData.address.province) + '</p>' +
            '<p><strong>Pagamento:</strong> ' + this.escapeHTML(orderData.payment) + '</p>' +
            '<p><strong>Total:</strong> ' + self.formatKz(orderData.totals.total) + '</p>' +
            '<hr style="border:none;border-top:1px solid #eee;margin:16px 0;">' +
            '<p style="font-size:14px;color:#666;">' + itemsList + '</p>';
    },

    // Enviar e-mail de confirmação ao cliente
    sendOrderConfirmation: async function(orderData) {
        try {
            var sendFn = firebase.functions().httpsCallable('sendOrderEmail');
            var html = this.generateOrderHTML(orderData);

            var result = await sendFn({
                toEmail: orderData.customer.email,
                toName: orderData.customer.name,
                subject: 'AODA Store — Confirmação do Pedido ' + orderData.id,
                html: html
            });

            console.log('[Email] Confirmação enviada para:', orderData.customer.email);
            return result.data;
        } catch (error) {
            console.error('[Email] Erro ao enviar confirmação:', error);
            return { error: true };
        }
    },

    // Enviar notificação ao admin
    sendAdminNotification: async function(orderData) {
        try {
            var sendFn = firebase.functions().httpsCallable('sendAdminNotification');
            var html = this.generateAdminHTML(orderData);

            await sendFn({
                toEmail: 'contacto@aodastore.co.ao',
                subject: '[NOVA ENCOMENDA] ' + orderData.id + ' — ' + orderData.customer.name,
                html: html
            });

            console.log('[Email] Notificação admin enviada');
        } catch (error) {
            console.error('[Email] Erro notificação admin:', error);
        }
    },

    // Enviar ambos
    sendOrderEmails: async function(orderData) {
        var results = await Promise.allSettled([
            this.sendOrderConfirmation(orderData),
            this.sendAdminNotification(orderData)
        ]);

        var confirmationOk = results[0].status === 'fulfilled' && !results[0].value?.error;
        console.log('[Email] Resultado — Cliente:', confirmationOk ? 'OK' : 'FALHOU');

        return confirmationOk;
    },

    // Utilitários
    formatKz: function(num) {
        if (typeof num !== 'number') return num || '-';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Kz';
    }
};