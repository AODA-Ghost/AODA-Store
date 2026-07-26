// shared-ux.js
// Utilitários de UX: skeletons, breadcrumbs, fallbacks

var SharedUX = {

    // ==========================================
    // SKELETON LOADING
    // ==========================================

    // Gerar skeleton de produtos
    renderProductSkeletons(count) {
        count = count || 6;
        var html = '';
        for (var i = 0; i < count; i++) {
            html += '<div class="skeleton-card">' +
                '<div class="skeleton skeleton-image"></div>' +
                '<div class="skeleton-lines">' +
                    '<div class="skeleton-text short"></div>' +
                    '<div class="skeleton-text medium"></div>' +
                    '<div class="skeleton-text price"></div>' +
                    '<div class="skeleton-button"></div>' +
                '</div>' +
            '</div>';
        }
        return html;
    },

    // Gerar skeleton do carrinho
    renderCartSkeletons(count) {
        count = count || 2;
        var html = '';
        for (var i = 0; i < count; i++) {
            html += '<div class="skeleton-cart-item">' +
                '<div class="skeleton skeleton-cart-thumb"></div>' +
                '<div class="skeleton-cart-info">' +
                    '<div class="skeleton-text medium"></div>' +
                    '<div class="skeleton-text short"></div>' +
                    '<div class="skeleton-text short"></div>' +
                    '<div class="skeleton-text price"></div>' +
                '</div>' +
                '<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">' +
                    '<div class="skeleton" style="width:100px;height:36px;border-radius:8px;"></div>' +
                '</div>' +
            '</div>';
        }
        return html;
    },

    // Gerar skeleton do resumo
    renderTotalsSkeleton() {
        return '<div class="skeleton-totals">' +
            '<div class="skeleton-total-row short"></div>' +
            '<div class="skeleton-total-row long"></div>' +
            '<div class="skeleton-total-row short"></div>' +
            '<div class="skeleton-total-row medium"></div>' +
            '<div style="height:44px;border-radius:8px;background:#E8E5E0;margin-top:12px;"></div>' +
        '</div>';
    },

    // Gerar skeleton da tabela do admin
    renderTableSkeleton(rows) {
        rows = rows || 5;
        var html = '';
        for (var i = 0; i < rows; i++) {
            html += '<div class="skeleton-table-row">' +
                '<div class="skeleton-cell"></div>' +
                '<div class="skeleton-cell"></div>' +
                '<div class="skeleton-cell"></div>' +
                '<div class="skeleton-cell"></div>' +
                '<div class="skeleton-cell"></div>' +
            '</div>';
        }
        return html;
    },

    // Mostrar skeleton e esconder conteúdo real
    showSkeleton(container, skeletonHTML) {
        if (!container) return;
        var originalContent = container.innerHTML;
        container.innerHTML = skeletonHTML;
        return function restore() {
            container.innerHTML = originalContent;
        };
    },

    // ==========================================
    // BREADCRUMBS
    // ==========================================

    // Gerar e injetar breadcrumbs
    renderBreadcrumbs(items) {
        // Remover skeleton se existir
        var existing = document.getElementById('breadcrumbsBar');
        if (existing) existing.remove();

        var container = document.createElement('nav');
        container.id = 'breadcrumbsBar';
        container.className = 'breadcrumbs';
        container.setAttribute('aria-label', 'Navegação estrutural');

        var html = '';
        for (var i = 0; i < items.length; i++) {
            var item = items[i];

            if (i > 0) {
                html += '<span class="breadcrumb-sep">›</span>';
            }

            if (item.isCurrent) {
                html += '<span class="breadcrumb-current">' + item.label + '</span>';
            } else if (item.url) {
                html += '<a href="' + item.url + '" class="breadcrumb-item">' + item.label + '</a>';
            } else {
                html += '<span class="breadcrumb-item">' + item.label + '</span>';
            }
        }

        container.innerHTML = html;

        // Inserir antes do conteúdo principal
        var mainEl = document.querySelector('.main-content') ||
                      document.querySelector('.featured-section') ||
                      document.querySelector('.content-page');

        if (mainEl) {
            mainEl.parentNode.insertBefore(container, mainEl);
        }
    },

    // Definições de breadcrumbs por página
    getBreadcrumbs: function() {
        var path = window.location.pathname;
        var page = path.replace('.html', '').replace('/', '') || 'index';

        var crumbsMap = {
            'index': [
                { label: 'Início', url: 'index.html' }
            ],
            'products': [
                { label: 'Início', url: 'index.html' },
                { label: 'Produtos', isCurrent: true }
            ],
            'cart': [
                { label: 'Início', url: 'index.html' },
                { label: 'Carrinho', isCurrent: true }
            ],
            'checkout': [
                { label: 'Início', url: 'index.html' },
                { label: 'Produtos', url: 'products.html' },
                { label: 'Finalizar Compra', isCurrent: true }
            ],
            'checkout-success': [
                { label: 'Início', url: 'index.html' },
                { label: 'Carrinho', url: 'cart.html' },
                { label: 'Confirmação', isCurrent: true }
            ],
            'about': [
                { label: 'Início', url: 'index.html' },
                { label: 'Sobre Nós', isCurrent: true }
            ],
            'contact': [
                { label: 'Início', url: 'index.html' },
                { label: 'Contacto', isCurrent: true }
            ],
            'faq': [
                { label: 'Início', url: 'index.html' },
                { label: 'Perguntas Frequentes', isCurrent: true }
            ],
            'privacy': [
                { label: 'Início', url: 'index.html' },
                { label: 'Privacidade', isCurrent: true }
            ],
            'terms': [
                { label: 'Início', url: 'index.html' },
                { label: 'Termos e Condições', isCurrent: true }
            ],
            'returns': [
                { label: 'Início', url: 'index.html' },
                { label: 'Devoluções', isCurrent: true }
            ],
            'account': [
                { label: 'Início', url: 'index.html' },
                { label: 'Minha Conta', isCurrent: true }
            ],
            'admin': [
                { label: 'Início', url: 'index.html' },
                { label: 'Admin', isCurrent: true }
            ]
        };

        return crumbsMap[page] || crumbsMap['index'];
    },

    // ==========================================
    // IMAGE FALLBACKS
    // ==========================================

    // Gerar HTML de fallback para imagem
    getImgFallbackHTML: function(altText) {
        return '<div class="img-fallback">' +
            '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 15"/></svg>' +
            '<span>Imagem indisponível</span>' +
        '</div>';
    },

    // Processar erro de imagem — substitui o container pelo fallback
    handleImgError(img) {
        if (!img || img.dataset.fallbackDone) return;
        img.dataset.fallbackDone = 'true';

        // Se está dentro de um container com overflow hidden, aplicar no container
        var wrapper = img.closest('.product-image, .recommendation-image, .cart-item-image, .summary-item-img');

        if (wrapper) {
            wrapper.classList.add('img-error-wrapper');
            // Manter o img escondido mas acessível ao SEO
            img.style.position = 'absolute';
            img.style.width = '1px';
            img.style.height = '1px';
            img.style.opacity = '0';
            wrapper.insertAdjacentHTML('before', this.getImgFallbackHTML(img.alt || ''));
        } else {
            // Fallback direto no img
            img.style.opacity = '0.3';
            img.style.filter = 'grayscale(100%) blur(2px)';
            img.alt = 'Imagem indisponível';
        }
    },

    // Aplicar fallback a todas as imagens da página
    initImageFallbacks: function() {
        document.querySelectorAll('img').forEach(function(img) {
            img.addEventListener('error', function() {
                SharedUX.handleImgError(img);
            });
            // Se já falhou antes de o JS carregar (cache)
            if (img.complete && img.naturalWidth === 0) {
                SharedUX.handleImgError(img);
            }
        });
    }
};