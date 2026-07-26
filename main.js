// AODA Store - Main JavaScript
// Gestão de carrinho, filtros, animações e funcionalidades interativas

class AodaStoreApp {
    constructor() {
        this.cart = this.loadCart();
        this.activePromo = null;
        this.products = this.initializeProducts();
        this.filters = {
            style: [],
            color: [],
            priceRange: [0, 50000]
        };
        this.currentSort = 'name';
        this.init();
    }
        // ==========================================
    // OPEN GRAPH + JSON-LD
    // ==========================================

    SITE_URL = 'https://aodastore.co.ao';

    // Atualizar meta tags e JSON-LD da página
    updateMetaTags(metaData) {
        document.title = metaData.title || document.title;
        
        // Open Graph
        this.setMeta('og:title', metaData.title);
        this.setMeta('og:description', metaData.description);
        this.setMeta('og:image', metaData.image);
        this.setMeta('og:url', metaData.url);
        this.setMeta('og:type', metaData.ogType || 'website');
        this.setMeta('og:site_name', 'AODA Store');
        this.setMeta('og:locale', 'pt-AO');

        // Twitter Card
        this.setMeta('twitter:card', 'summary_large_image');
        this.setMeta('twitter:title', metaData.title);
        this.setMeta('twitter:description', metaData.description);
        this.setMeta('twitter:image', metaData.image);

        // JSON-LD (remove anterior se existir)
        var existingLd = document.getElementById('structured-data');
        if (existingLd) existingLd.remove();

        if (metaData.structuredData) {
            var script = document.createElement('script');
            script.type = 'application/ld+json';
            script.id = 'structured-data';
            script.textContent = JSON.stringify(metaData.structuredData);
            document.head.appendChild(script);
        }
    }

    // Definir meta tag com fallback
    setMeta(name, content) {
        var meta = document.querySelector('meta[property="' + name + '"]');
        if (meta) {
            meta.setAttribute('content', content);
        } else {
            meta = document.createElement('meta');
            meta.setAttribute('property', name);
            meta.setAttribute('content', content);
            document.head.appendChild(meta);
        }
    }

    // Gerar OG + JSON-LD para a página inicial
    generateIndexMeta() {
        return {
            title: 'AODA Store | T-Shirts Oficiais',
            description: 'Descubra as t-shirts oficiais da AODA. Design exclusivo, qualidade premium e conforto para o estilo urbano angolano. Envio grátis acima de 15.000 Kz.',
            url: this.SITE_URL,
            image: this.SITE_URL + 'resources/hero_urban.jpg',
            ogType: 'website',
            structuredData: {
                "@context": "https://schema.org",
                "@type": "WebSite",
                "name": "AODA Store",
                "url": this.SITE_URL,
                "description": "T-shirts oficiais da AODA Store. Design exclusivo, qualidade premium e conforto para o estilo urbano angolano.",
                "brand": {
                    "@type": "Organization",
                    "name": "AODA Store",
                    "logo": this.SITE_URL + "resources/favicon.svg"
                },
                "potentialAction": {
                    "@type": "SearchAction",
                    "target": this.SITE_URL + 'products.html',
                    "query-input": "t-shirts AODA"
                }
            }
        };
    }

    // Gerar OG + JSON-LD para a página de produtos
    generateProductsMeta() {
        var self = this;
        var items = this.products.map(function(p) {
            return {
                "@type": "ListItem",
                "position": p.id,
                "item": {
                    "@type": "Product",
                    "name": p.name,
                    "description": p.description,
                    "image": self.SITE_URL + p.image,
                    "url": self.SITE_URL + 'products.html',
                    "brand": { "@type": "Organization", "name": "AODA Store" },
                    "offers": {
                        "@type": "Offer",
                        "price": p.price,
                        "priceCurrency": "AOA",
                        "availability": "https://schema.org/InStock"
                    }
                }
            };
        });

        return {
            title: 'Produtos — AODA Store | T-Shirts Oficiais',
            description: 'Explora a coleção completa de t-shirts oficiais da AODA Store. Design exclusivo, qualidade premium e conforto. 12 modelos disponíveis.',
            url: self.SITE_URL + 'products.html',
            image: self.SITE_URL + 'resources/product-1.jpg',
            ogType: 'website',
            structuredData: {
                "@context": "https://schema.org",
                "@type": "ItemList",
                "name": "Coleção Completa de T-Shirts AODA Store",
                "description": "12 modelos de t-shirts oficiais com design exclusivo, qualidade premium e conforto para o estilo urbano.",
                "url": self.SITE_URL + 'products.html',
                "numberOfItems": self.products.length,
                "itemListElement": items
            }
        };
    }

    // Gerar OG + JSON-LD individual quando o modal abre (para partilha social)
    generateProductMeta(product) {
        return {
            title: product.name + ' — AODA Store',
            description: product.description,
            image: this.SITE_URL + product.image,
            url: this.SITE_URL + 'products.html',
            ogType: 'product',
            structuredData: {
                "@context": "https://schema.org",
                "@type": "Product",
                "name": product.name,
                "description": product.description,
                "image": this.SITE_URL + product.image,
                "url": this.SITE_URL + 'products.html',
                "brand": { "@type": "Organization", "name": "AODA Store" },
                "offers": {
                    "@type": "Offer",
                    "price": product.price,
                    "priceCurrency": "AOA",
                    "availability": "https://schema.org/InStock"
                }
            }
        };
    }

    // Atualizar meta quando o modal de produto abre
    updateProductModalMeta(product) {
        var meta = this.generateProductMeta(product);
        this.updateMetaTags(meta);
    }

             init() {
        this.updateCartCounter();
        this.initializeAnimations();
        this.bindEvents();
        this.initializeFilters();
        this.loadPageContent();
        this.initMobileMenu();
        this.initAuthUI();  // <-- ADICIONAR

        // Substitui o catálogo de reserva (hardcoded) pelos produtos reais
        // geridos no admin, assim que estiverem disponíveis. Não bloqueia o
        // primeiro render: a página já aparece com o catálogo de reserva e
        // troca discretamente para os dados reais quando chegam.
        this.loadProductsFromFirestore();

        // Inicializar EmailJS se disponível (usado na página de checkout)
        if (typeof EmailService !== 'undefined' && typeof EmailService.init === 'function') {
            try {
                EmailService.init();
            } catch (e) {
                console.error('[App] Erro ao inicializar EmailService:', e);
            }
        }
    }

    // ========== Catálogo real (Firestore) ==========
    // Busca os produtos ativos geridos no admin. Se a busca falhar ou
    // devolver zero produtos (ex: loja ainda sem nenhum produto cadastrado,
    // ou Firebase indisponível), mantém o catálogo de reserva sem quebrar a
    // página.
    loadProductsFromFirestore() {
        var self = this;
        if (typeof AodaBackend === 'undefined' || typeof AodaBackend.getActiveProducts !== 'function') return;

        AodaBackend.getActiveProducts().then(function(docs) {
            if (!docs || docs.length === 0) return; // mantém o catálogo de reserva

            self.products = docs.map(function(p) { return self.normalizeFirestoreProduct(p); });

            // Volta a renderizar o que já estiver na página com os dados reais
            if (document.querySelector('.products-grid')) {
                self.applyFilters();
            }
        }).catch(function(e) {
            console.error('[App] Não foi possível carregar produtos do Firestore, a manter catálogo de reserva.', e);
        });
    }

    // Converte um documento de produto do Firestore (schema do admin.html)
    // para o formato usado pela loja (mesmo shape do catálogo de reserva).
    normalizeFirestoreProduct(p) {
        var images = (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
        return {
            id: p.id,
            name: p.name || 'Produto',
            color: p.color || '',
            price: (p.salePrice && p.salePrice > 0) ? p.salePrice : (p.price || 0),
            style: p.category || 'Casual',
            sizes: (p.sizes && p.sizes.length) ? p.sizes : ['S', 'M', 'G', 'GG', 'XL'],
            image: images[0] || 'resources/product-1.jpg',
            images: images,
            description: p.description || '',
            features: p.brand ? [p.brand] : [],
            stock: (typeof p.stock === 'number') ? p.stock : null,
            brand: p.brand || '',
            sku: p.sku || '',
            _ts: (p.createdAt && typeof p.createdAt.toMillis === 'function') ? p.createdAt.toMillis() : Date.now()
        };
    }

        // ========== AUTH UI ==========
    initAuthUI() {
        var self = this;

        // AuthService só está disponível nas páginas que carregam auth-service.js
        // (account.html, auth.html, checkout.html). Nas restantes, sair sem erro.
        if (typeof AuthService === 'undefined') return;

        var navContainer = document.querySelector('.hidden.md\\:block');

        if (!navContainer) return;

        AuthService.onAuthStateChanged(function(authState) {
            // Procurar o container de links da navbar
            var linksContainer = navContainer.querySelector('.flex.items-baseline');
            if (!linksContainer) return;

            var existingAccountLink = document.getElementById('navAccountLink');
            if (existingAccountLink) existingAccountLink.remove();

            if (authState.loggedIn) {
                // Adicionar link "Conta" com nome do utilizador
                var accountLink = document.createElement('a');
                accountLink.id = 'navAccountLink';
                accountLink.href = 'account.html';
                accountLink.className = 'nav-link text-sage px-3 py-2 text-sm font-medium';
                accountLink.textContent = authState.name || 'Conta';

                // Inserir antes do link do carrinho
                var cartLink = linksContainer.querySelector('[href="cart.html"]');
                if (cartLink) {
                    linksContainer.insertBefore(accountLink, cartLink);
                }
            }

            // Atualizar contador em todas as páginas
            self.updateCartCounter();
        });
    }
        // ========== CHECKOUT: Resumo lateral ==========
    renderCheckoutSummary() {
        var itemsContainer = document.getElementById('summaryItems');
        if (!itemsContainer) return;
        var self = this;

        if (this.cart.length === 0) {
            itemsContainer.innerHTML = '<p style="color:#999;text-align:center;padding:2rem 0;">Nenhum item no carrinho</p>';
            document.getElementById('summaryTotals').innerHTML = '';
            return;
        }

        itemsContainer.innerHTML = this.cart.map(function(item) {
            var price = self.parsePrice(item.price);
            var lineTotal = price * item.qty;
            return '<div class="summary-item">' +
                '<img src="' + item.image + '" alt="' + item.name + '" class="summary-item-img">' +
                '<div class="summary-item-info">' +
                    '<div class="summary-item-name">' + item.name + '</div>' +
                    '<div class="summary-item-meta">' + item.color + ' · ' + item.size + ' · Qtd: ' + item.qty + '</div>' +
                '</div>' +
                '<div class="summary-item-price">' + self.formatPrice(lineTotal) + '</div>' +
            '</div>';
        }).join('');

        this.renderCheckoutTotals(0);
    }

    renderCheckoutTotals(customShipping) {
        var self = this;
        var subtotal = this.cart.reduce(function(sum, item) {
            return sum + (self.parsePrice(item.price) * item.qty);
        }, 0);

        var d = this.calculateDiscount(subtotal);
        var discount = d.discount;

        var afterDiscount = subtotal - discount;
        var shipping = typeof customShipping === 'number' ? customShipping : 0;
        if (d.freeShipping) shipping = 0;
        var total = afterDiscount + shipping;

        var container = document.getElementById('summaryTotals');
        if (!container) return;

        var html = '<div class="totals-row"><span>Subtotal:</span><span>' + this.formatPrice(subtotal) + '</span></div>';

        if (discount > 0) {
            html += '<div class="totals-row" style="color:#A8B5A0;"><span>Desconto:</span><span>-' + this.formatPrice(discount) + '</span></div>';
        } else if (d.freeShipping) {
            html += '<div class="totals-row" style="color:#A8B5A0;"><span>Cupão:</span><span>Envio grátis</span></div>';
        }

        html += '<div class="totals-row"><span>Envio:</span><span>' + (shipping === 0 ? 'Grátis' : this.formatPrice(shipping)) + '</span></div>';
        html += '<div class="totals-row total"><span>Total:</span><span>' + this.formatPrice(total) + '</span></div>';

        container.innerHTML = html;

        // Atualizar preço da entrega standard no formulário
        var standardPrice = document.getElementById('standardPrice');
        if (standardPrice) {
            standardPrice.textContent = (subtotal >= 15000 || customShipping === 0) ? 'Grátis' : '1.500 Kz';
        }
    }

    getCheckoutTotals(shipping) {
        var self = this;
        var subtotal = this.cart.reduce(function(sum, item) {
            return sum + (self.parsePrice(item.price) * item.qty);
        }, 0);
        var d = this.calculateDiscount(subtotal);
        var discount = d.discount;
        var finalShipping = d.freeShipping ? 0 : shipping;
        return {
            subtotal: subtotal,
            discount: discount,
            couponCode: this.activePromo ? this.activePromo.code : null,
            couponId: this.activePromo ? this.activePromo.id : null,
            shipping: finalShipping,
            total: subtotal - discount + finalShipping
        };
    }

    // ========== Dados dos Produtos ==========
    initializeProducts() {
        return [
            {
                id: 1,
                name: "AODA Classic",
                color: "Verde Militar",
                price: 12000,
                style: "Casual",
                sizes: ["S", "M", "G", "GG", "XL"],
                image: "resources/product-1.jpg",
                description: "T-shirt clássica com design atemporal. Tecido macio e confortável para o dia a dia.",
                features: ["Conforto premium", "Tecido respirável", "Durabilidade"]
            },
            {
                id: 2,
                name: "AODA Signature",
                color: "Vermelho",
                price: 10000,
                style: "Casual",
                sizes: ["S", "M", "G", "GG", "XL"],
                image: "resources/product-2.jpg",
                description: "A peça de assinatura da AODA. Vermelho intenso com acabamento impecável.",
                features: ["Cor vibrante", "Corte moderno", "Acabamento premium"]
            },
            {
                id: 3,
                name: "AODA Urban",
                color: "Cinza",
                price: 25000,
                style: "Urban",
                sizes: ["S", "M", "G", "GG", "XG"],
                image: "resources/product-3.jpg",
                description: "Criada para a vida urbana. Estilo e conforto em cada detalhe.",
                features: ["Estilo urbano", "Alta durabilidade", "Corte regular"]
            },
            {
                id: 4,
                name: "AODA Minimal",
                color: "Off-White",
                price: 20000,
                style: "Premium",
                sizes: ["S", "M", "G", "GG"],
                image: "resources/product-4.jpg",
                description: "Minimalismo sofisticado. Menos é mais com esta peça premium.",
                features: ["Design minimalista", "Tecido premium", "Versatilidade"]
            },
            {
                id: 5,
                name: "AODA Ghost",
                color: "Azul Marinho",
                price: 35000,
                style: "Premium",
                sizes: ["M", "G", "GG", "XG"],
                image: "resources/product-5.jpg",
                description: "Edição limitada com design exclusivo. Para quem quer destacar-se.",
                features: ["Edição especial", "Design exclusivo", "Alta qualidade"]
            },
            {
                id: 6,
                name: "AODA Limited",
                color: "Verde Oliva",
                price: 40000,
                style: "Premium",
                sizes: ["M", "G", "GG"],
                image: "resources/product-6.jpg",
                description: "Série limitada com materiais selecionados. Uma peça de colecionador.",
                features: ["Série limitada", "Materiais raros", "Numeração exclusiva"]
            },
            {
                id: 7,
                name: "AODA Nomad",
                color: "Areia",
                price: 14000,
                style: "Casual",
                sizes: ["S", "M", "G", "GG"],
                image: "resources/product-7.jpg",
                description: "Para o espírito nómada. Conforto que te acompanha em qualquer lugar.",
                features: ["Leveza", "Conforto extensivo", "Cor neutra"]
            },
            {
                id: 8,
                name: "AODA Fluxo",
                color: "Laranja",
                price: 16000,
                style: "Urban",
                sizes: ["S", "M", "G", "GG", "XL"],
                image: "resources/product-8.jpg",
                description: "Energia e movimento. A t-shirt que traduz a vida urbana em estilo.",
                features: ["Cor energética", "Corte dinâmico", "Tecido flexível"]
            },
            {
                id: 9,
                name: "AODA Runner",
                color: "Branco",
                price: 15500,
                style: "Desportivo",
                sizes: ["S", "M", "G", "GG", "XG", "XL"],
                image: "resources/product-9.jpg",
                description: "Performance e estilo desportivo. Ideal para quem vive em movimento.",
                features: ["Tecido técnico", "Secagem rápida", "Mobilidade total"]
            },
            {
                id: 10,
                name: "AODA Street",
                color: "Azul Claro",
                price: 13500,
                style: "Urban",
                sizes: ["S", "M", "G", "GG", "XG"],
                image: "resources/product-10.jpg",
                description: "A essência da cultura street. Autenticidade em cada pormenor.",
                features: ["Cultura street", "Autenticidade", "Estilo marcante"]
            },
            {
                id: 11,
                name: "AODA Premium",
                color: "Preto",
                price: 18500,
                style: "Premium",
                sizes: ["S", "M", "G", "GG", "XG", "XL"],
                image: "resources/product-11.jpg",
                description: "O topo da gama AODA. Preto sofisticado com acabamento de luxo.",
                features: ["Alta gama", "Acabamento de luxo", "Elegância"]
            },
            {
                id: 12,
                name: "AODA Essential",
                color: "Cinza Escuro",
                price: 11000,
                style: "Casual",
                sizes: ["S", "M", "G", "GG", "XL"],
                image: "resources/product-12.jpg",
                description: "A essencial do guarda-roupa. Simplicidade que nunca falha.",
                features: ["Básica essencial", "Versatilidade", "Preço acessível"]
            }
        ];
    }

    // ========== Utilitários ==========
    parsePrice(price) {
        if (typeof price === 'number') return price;
        var numStr = String(price).replace(/[^\d]/g, '');
        return parseInt(numStr, 10) || 0;
    }

    formatPrice(price) {
        var num = typeof price === 'number' ? price : this.parsePrice(price);
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Kz';
    }

    loadCart() {
        try {
            return JSON.parse(localStorage.getItem('aoda_cart')) || [];
        } catch (e) {
            return [];
        }
    }

    // ========== Gestão do Carrinho ==========
    addToCart(productId, size) {
        var product = this.products.find(function(p) { return String(p.id) === String(productId); });
        if (!product) return;
        if (!size) size = product.sizes[0];

        if (typeof product.stock === 'number' && product.stock <= 0) {
            this.showToast(product.name + ' está esgotado no momento.');
            return;
        }

        var existingItem = this.cart.find(function(item) {
            return String(item.id) === String(productId) && item.size === size;
        });

        // Não deixa adicionar mais unidades do que o stock disponível
        if (typeof product.stock === 'number') {
            var currentQty = existingItem ? existingItem.qty : 0;
            if (currentQty + 1 > product.stock) {
                this.showToast('Só há ' + product.stock + ' unidade(s) de ' + product.name + ' em stock.');
                return;
            }
        }

        if (existingItem) {
            existingItem.qty += 1;
        } else {
            this.cart.push({
                id: product.id,
                name: product.name,
                color: product.color,
                price: product.price,
                size: size,
                qty: 1,
                image: product.image
            });
        }

        this.saveCart();
        this.updateCartCounter();
        this.showAddToCartAnimation();
        this.showToast(product.name + ' (' + size + ') adicionado ao carrinho');
    }

    removeFromCart(productId, size) {
        this.cart = this.cart.filter(function(item) {
            return !(String(item.id) === String(productId) && item.size === size);
        });
        this.saveCart();
        this.updateCartCounter();
        this.renderCart();
    }

    updateQuantity(productId, size, newQuantity) {
        if (newQuantity <= 0) {
            this.removeFromCart(productId, size);
            return;
        }
        var item = this.cart.find(function(i) {
            return String(i.id) === String(productId) && i.size === size;
        });
        if (item) {
            item.qty = newQuantity;
            this.saveCart();
            this.updateCartCounter();
            this.renderCart();
        }
    }

    clearCart() {
        this.cart = [];
        this.activePromo = null;
        this.saveCart();
        this.updateCartCounter();
        this.renderCart();
    }

    saveCart() {
        localStorage.setItem('aoda_cart', JSON.stringify(this.cart));
    }

    updateCartCounter() {
        var counters = document.querySelectorAll('.cart-counter');
        var totalItems = this.cart.reduce(function(sum, item) { return sum + item.qty; }, 0);
        counters.forEach(function(counter) {
            counter.textContent = totalItems;
            counter.style.display = totalItems > 0 ? 'flex' : 'none';
            if (totalItems > 0) {
                counter.classList.remove('pulse');
                void counter.offsetWidth;
                counter.classList.add('pulse');
            }
        });
        this.updateMobileCartBadge(); // <-- ADICIONAR ESTA LINHA
      

    }

    

    showAddToCartAnimation() {
        var counters = document.querySelectorAll('.cart-counter');
        counters.forEach(function(counter) {
            counter.classList.remove('pulse');
            void counter.offsetWidth;
            counter.classList.add('pulse');
        });
    }

    // ========== Toast ==========
    showToast(message) {
        var existing = document.getElementById('appToast');
        if (existing) existing.remove();

        var toast = document.createElement('div');
        toast.id = 'appToast';
        toast.style.cssText = 'position:fixed;bottom:2rem;right:2rem;background:#2C2C2C;color:white;padding:1rem 1.5rem;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.2);z-index:9999;transform:translateY(100px);opacity:0;transition:all 0.4s ease;font-size:0.95rem;font-family:DM Sans,sans-serif;display:flex;align-items:center;gap:0.75rem;max-width:90vw;';
        toast.innerHTML = '<div style="width:24px;height:24px;background:#A8B5A0;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div><span>' + message + '</span>';
        document.body.appendChild(toast);

        requestAnimationFrame(function() {
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
        });

        setTimeout(function() {
            toast.style.transform = 'translateY(100px)';
            toast.style.opacity = '0';
            setTimeout(function() { toast.remove(); }, 400);
        }, 2500);
    }

    // ========== Filtros ==========
    applyFilters() {
        var self = this;
        var filtered = this.products.filter(function(p) {
            // Estilo
            if (self.filters.style.length > 0 && self.filters.style.indexOf(p.style) === -1) {
                return false;
            }
            // Cor
            if (self.filters.color.length > 0) {
                var colorMatch = false;
                self.filters.color.forEach(function(fc) {
                    if (p.color.toLowerCase().indexOf(fc.toLowerCase()) !== -1) {
                        colorMatch = true;
                    }
                });
                if (!colorMatch) return false;
            }
            // Preço
            if (p.price < self.filters.priceRange[0] || p.price > self.filters.priceRange[1]) {
                return false;
            }
            return true;
        });

        // Ordenar
        filtered = this.sortProducts(filtered, this.currentSort);

        this.renderProducts(filtered);
        this.updateResultsCounter(filtered.length);
    }

    sortProducts(products, sortBy) {
        var sorted = products.slice();
        switch (sortBy) {
            case 'price-low':
                sorted.sort(function(a, b) { return a.price - b.price; });
                break;
            case 'price-high':
                sorted.sort(function(a, b) { return b.price - a.price; });
                break;
            case 'newest':
                // b.id - a.id só funciona com IDs numéricos (catálogo de reserva).
                // Produtos do Firestore têm ID string, por isso usamos _ts
                // (timestamp de criação), com o próprio id numérico como
                // segundo critério de fallback quando _ts não existe.
                sorted.sort(function(a, b) {
                    var ta = typeof a._ts === 'number' ? a._ts : (typeof a.id === 'number' ? a.id : 0);
                    var tb = typeof b._ts === 'number' ? b._ts : (typeof b.id === 'number' ? b.id : 0);
                    return tb - ta;
                });
                break;
            default:
                sorted.sort(function(a, b) { return a.name.localeCompare(b.name); });
        }
        return sorted;
    }

    handleSort(sortBy) {
        this.currentSort = sortBy;
        this.applyFilters();
    }

    updateResultsCounter(count) {
        var counter = document.querySelector('.results-counter');
        if (counter) {
            counter.textContent = count + ' produtos encontrados';
        }
    }

    handleSearch(query) {
        var self = this;
        var q = query.toLowerCase().trim();
        if (!q) {
            this.applyFilters();
            return;
        }
        var filtered = this.products.filter(function(p) {
            return p.name.toLowerCase().indexOf(q) !== -1 ||
                   p.color.toLowerCase().indexOf(q) !== -1 ||
                   p.description.toLowerCase().indexOf(q) !== -1 ||
                   p.style.toLowerCase().indexOf(q) !== -1;
        });
        this.renderProducts(filtered);
        this.updateResultsCounter(filtered.length);
    }

    clearAllFilters() {
        this.filters = {
            style: [],
            color: [],
            priceRange: [0, 50000]
        };
        this.activePromo = null;

        document.querySelectorAll('.filter-checkbox').forEach(function(cb) {
            cb.checked = false;
        });

        var slider = document.querySelector('.price-range-slider');
        if (slider) {
            slider.value = 50000;
            var display = document.querySelector('.max-price');
            if (display) display.textContent = '50.000 Kz';
        }

        this.applyFilters();
        this.renderCart();
    }

    // ========== Renderização ==========
    renderProducts(products) {
        var container = document.querySelector('.products-grid');
        if (!container) return;

        if (!products || products.length === 0) {
            container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:4rem 2rem;"><p style="font-size:1.1rem;color:#666;margin-bottom:1rem;">Nenhum produto encontrado com os filtros selecionados.</p><button onclick="app.clearAllFilters()" style="background:#A8B5A0;color:white;border:none;padding:0.75rem 2rem;border-radius:8px;cursor:pointer;font-size:0.95rem;">Limpar Filtros</button></div>';
            return;
        }

        var self = this;
        container.innerHTML = products.map(function(product) {
            var sizeOptions = product.sizes.map(function(s) {
                return '<option value="' + s + '">Tamanho ' + s + '</option>';
            }).join('');

            var outOfStock = (typeof product.stock === 'number' && product.stock <= 0);

            return '<div class="product-card" data-product-id="' + product.id + '">' +
                '<div class="product-image">' +
                    '<img src="' + product.image + '" alt="' + product.name + '" loading="lazy">' +
                    (outOfStock ? '<span class="out-of-stock-badge" style="position:absolute;top:10px;left:10px;background:#2C2C2C;color:#fff;font-size:.75rem;padding:.25rem .6rem;border-radius:6px;">Esgotado</span>' : '') +
                    '<div class="product-overlay">' +
                        '<button class="quick-view-btn" onclick="app.openProductModal(\'' + product.id + '\')">Visualizar</button>' +
                    '</div>' +
                '</div>' +
                '<div class="product-info">' +
                    '<h3 class="product-name">' + product.name + '</h3>' +
                    '<p class="product-color">' + product.color + '</p>' +
                    '<p class="product-price">' + self.formatPrice(product.price) + '</p>' +
                    '<div class="product-features">' +
                        product.features.map(function(f) { return '<span class="feature-tag">' + f + '</span>'; }).join('') +
                    '</div>' +
                    '<div class="product-actions">' +
                        '<select class="size-select" data-product-id="' + product.id + '">' + sizeOptions + '</select>' +
                        (outOfStock ?
                            '<button class="add-to-cart-btn" disabled style="opacity:.5;cursor:not-allowed;">Esgotado</button>' :
                            '<button class="add-to-cart-btn" onclick="app.addToCart(\'' + product.id + '\', this.previousElementSibling.value)">Adicionar</button>') +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');

        this.initializeProductAnimations();
    }

        renderCart() {
        var container = document.querySelector('.cart-items');
        var totalsContainer = document.querySelector('.cart-totals');
        if (!container) return;
        var self = this;

        if (this.cart.length === 0) {
            // Remover skeletons
            var skelCart = document.getElementById('cartSkeleton');
            var skelTotals = document.getElementById('totalsSkeleton');
            if (skelCart) skelCart.remove();
            if (skelTotals) skelTotals.remove();

            container.innerHTML =
                '<div class="empty-cart">' +
                    '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5" style="margin:0 auto 1.5rem;display:block;"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>' +
                    '<p>O teu carrinho está vazio</p>' +
                    '<a href="products.html" class="continue-shopping-btn">Ver Produtos</a>' +
                '</div>';

            if (totalsContainer) totalsContainer.innerHTML = '';
            var checkoutBtn = document.getElementById('checkoutBtn');
            if (checkoutBtn) checkoutBtn.disabled = true;
            return;
        }

        // Remover skeletons
        var skelCart = document.getElementById('cartSkeleton');
        var skelTotals = document.getElementById('totalsSkeleton');
        if (skelCart) skelCart.remove();
        if (skelTotals) skelTotals.remove();

        if (checkoutBtn) checkoutBtn.disabled = false;

        container.innerHTML = this.cart.map(function(item) {
            var price = self.parsePrice(item.price);
            var lineTotal = price * item.qty;
            return '<div class="cart-item">' +
                '<img src="' + item.image + '" alt="' + item.name + '" class="cart-item-image" onerror="SharedUX.handleImgError(this)">' +
                '<div class="cart-item-details">' +
                    '<h4>' + item.name + '</h4>' +
                    '<p>Cor: ' + item.color + '</p>' +
                    '<p>Tamanho: ' + item.size + '</p>' +
                    '<p class="price">' + self.formatPrice(price) + '</p>' +
                '</div>' +
                '<div class="cart-item-controls">' +
                    '<div class="quantity-controls">' +
                        '<button onclick="app.updateQuantity(\'' + item.id + '\', \'' + item.size + '\', ' + (item.qty - 1) + ')">-</button>' +
                        '<span>' + item.qty + '</span>' +
                        '<button onclick="app.updateQuantity(\'' + item.id + '\', \'' + item.size + '\', ' + (item.qty + 1) + ')">+</button>' +
                    '</div>' +
                    '<button class="remove-item" onclick="app.removeFromCart(\'' + item.id + '\', \'' + item.size + '\')">Remover</button>' +
                '</div>' +
            '</div>';
        }).join('');

        this.updateCartTotal();
    }

    // Calcula o desconto a partir de this.activePromo, suportando cupões
    // reais validados via AodaBackend.validateCoupon (type: 'percentage'|'fixed').
    calculateDiscount(subtotal) {
        var promo = this.activePromo;
        if (!promo) return { discount: 0, freeShipping: false };

        if (promo.type === 'percentage') {
            return { discount: Math.round(subtotal * (promo.value / 100)), freeShipping: false };
        }
        if (promo.type === 'fixed') {
            return { discount: Math.min(promo.value, subtotal), freeShipping: false };
        }
        // Compatibilidade com o formato antigo (não deve ocorrer com cupões do Firestore)
        if (promo.value === 'free_shipping') return { discount: 0, freeShipping: true };
        if (typeof promo.value === 'number') return { discount: Math.round(subtotal * promo.value), freeShipping: false };
        return { discount: 0, freeShipping: false };
    }

    updateCartTotal() {
        var self = this;
        var subtotal = this.cart.reduce(function(sum, item) {
            return sum + (self.parsePrice(item.price) * item.qty);
        }, 0);

        var d = this.calculateDiscount(subtotal);
        var discount = d.discount;
        var freeShipping = d.freeShipping;

        var afterDiscount = subtotal - discount;
        var shipping = (freeShipping || afterDiscount >= 15000) ? 0 : 1500;
        var total = afterDiscount + shipping;

        var totalsContainer = document.querySelector('.cart-totals');
        if (totalsContainer) {
            var html =
                '<div class="totals-row"><span>Subtotal:</span><span>' + this.formatPrice(subtotal) + '</span></div>';

            if (discount > 0) {
                html += '<div class="totals-row" style="color:#A8B5A0;"><span>Desconto (' + this.activePromo.code + '):</span><span>-' + this.formatPrice(discount) + '</span></div>';
            } else if (freeShipping) {
                html += '<div class="totals-row" style="color:#A8B5A0;"><span>Cupão (' + this.activePromo.code + '):</span><span>Envio grátis</span></div>';
            }

            html +=
                '<div class="totals-row"><span>Envio:</span><span>' + (shipping === 0 ? 'GRÁTIS' : this.formatPrice(shipping)) + '</span></div>' +
                '<div class="totals-row total"><span>Total:</span><span>' + this.formatPrice(total) + '</span></div>';

            totalsContainer.innerHTML = html;
        }
    }

    // ========== Modal de Produto ==========
    openProductModal(productId) {
        var self = this;
        var product = this.products.find(function(p) { return String(p.id) === String(productId); });
        if (!product) return;

        var sizeOptions = product.sizes.map(function(s) {
            return '<option value="' + s + '">Tamanho ' + s + '</option>';
        }).join('');

        var outOfStock = (typeof product.stock === 'number' && product.stock <= 0);

        var modal = document.createElement('div');
        modal.className = 'product-modal active';
        modal.innerHTML =
            '<div class="modal-overlay" onclick="app.closeProductModal()"></div>' +
            '<div class="modal-content">' +
                '<button class="modal-close" onclick="app.closeProductModal()">&times;</button>' +
                '<div class="modal-image"><img src="' + product.image + '" alt="' + product.name + '"></div>' +
                '<div class="modal-details">' +
                    '<h2>' + product.name + '</h2>' +
                    '<p class="modal-color">Cor: ' + product.color + '</p>' +
                    '<p class="modal-price">' + self.formatPrice(product.price) + '</p>' +
                    (outOfStock ? '<p style="color:#c0392b;font-weight:600;">Esgotado no momento</p>' : '') +
                    '<p class="modal-description">' + product.description + '</p>' +
                    '<div class="modal-features">' +
                        product.features.map(function(f) { return '<span class="feature-tag">' + f + '</span>'; }).join('') +
                    '</div>' +
                    '<div class="modal-actions">' +
                        '<select class="modal-size-select" id="modal-size-select">' + sizeOptions + '</select>' +
                        (outOfStock ?
                            '<button class="modal-add-to-cart" disabled style="opacity:.5;cursor:not-allowed;">Esgotado</button>' :
                            '<button class="modal-add-to-cart" onclick="app.addToCart(\'' + product.id + '\', document.getElementById(\'modal-size-select\').value); app.closeProductModal();">Adicionar ao Carrinho</button>') +
                    '</div>' +
                    '<div class="modal-reviews" id="modalReviews" style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid #eee;">' +
                        '<h3 style="font-size:1rem;margin-bottom:.75rem;">Avaliações</h3>' +
                        '<div id="modalReviewsList" style="font-size:.9rem;color:#666;">A carregar avaliações…</div>' +
                    '</div>' +
                '</div>' +
            '</div>';

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        this.loadProductReviews(product.id);
    }

    // ========== Avaliações de produto ==========
    loadProductReviews(productId) {
        var self = this;
        if (typeof AodaBackend === 'undefined' || typeof AodaBackend.getReviewsByProduct !== 'function') {
            var listEl0 = document.getElementById('modalReviewsList');
            if (listEl0) listEl0.innerHTML = '';
            return;
        }

        AodaBackend.getReviewsByProduct(productId).then(function(reviews) {
            var listEl = document.getElementById('modalReviewsList');
            if (!listEl) return; // modal já foi fechado

            var html = '';
            if (reviews.length === 0) {
                html += '<p style="color:#999;">Ainda sem avaliações. Sê o primeiro a avaliar.</p>';
            } else {
                var avg = reviews.reduce(function(sum, r) { return sum + (r.rating || 0); }, 0) / reviews.length;
                html += '<p style="font-weight:600;margin-bottom:.5rem;">' + avg.toFixed(1) + ' / 5 · ' + reviews.length + ' avaliação(ões)</p>';
                html += reviews.slice(0, 5).map(function(r) {
                    return '<div style="margin-bottom:.75rem;">' +
                        '<strong>' + self.renderStars(r.rating) + '</strong> ' +
                        '<span style="color:#999;font-size:.8rem;">' + (r.customerName || 'Cliente') + '</span>' +
                        '<p style="margin:.15rem 0 0;">' + (r.comment || '') + '</p>' +
                    '</div>';
                }).join('');
            }

            html += self.renderReviewForm();
            listEl.innerHTML = html;
            self.bindReviewForm(productId);
        });
    }

    renderStars(n) {
        n = Math.max(0, Math.min(5, Math.round(n) || 0));
        return '★'.repeat(n) + '☆'.repeat(5 - n);
    }

    // Formulário de avaliação: só aparece se a página carregou o auth-service.js
    // (products.html) e o utilizador tiver sessão iniciada — evita reviews anónimas.
    renderReviewForm() {
        var user = (typeof AuthService !== 'undefined' && AuthService.getCurrentUser) ? AuthService.getCurrentUser() : null;
        if (!user) {
            return '<p style="margin-top:1rem;font-size:.85rem;"><a href="auth.html" style="color:#A8B5A0;">Inicia sessão</a> para avaliares este produto.</p>';
        }
        return '<div style="margin-top:1rem;">' +
            '<label style="font-size:.85rem;display:block;margin-bottom:.25rem;">A tua avaliação</label>' +
            '<select id="reviewRating" style="margin-bottom:.5rem;padding:.4rem;border-radius:6px;border:1px solid #ddd;">' +
                '<option value="5">★★★★★ (5)</option><option value="4">★★★★☆ (4)</option><option value="3">★★★☆☆ (3)</option><option value="2">★★☆☆☆ (2)</option><option value="1">★☆☆☆☆ (1)</option>' +
            '</select>' +
            '<textarea id="reviewComment" placeholder="Escreve a tua opinião…" style="width:100%;min-height:60px;padding:.5rem;border-radius:6px;border:1px solid #ddd;margin-bottom:.5rem;box-sizing:border-box;"></textarea>' +
            '<button type="button" id="reviewSubmitBtn" class="modal-add-to-cart" style="width:auto;padding:.5rem 1.25rem;">Enviar Avaliação</button>' +
            '<p id="reviewMsg" style="font-size:.8rem;margin-top:.4rem;"></p>' +
        '</div>';
    }

    bindReviewForm(productId) {
        var btn = document.getElementById('reviewSubmitBtn');
        if (!btn) return;
        btn.addEventListener('click', function() {
            var rating = parseInt(document.getElementById('reviewRating').value, 10);
            var comment = document.getElementById('reviewComment').value.trim();
            var msgEl = document.getElementById('reviewMsg');
            if (!comment) {
                msgEl.style.color = '#c0392b';
                msgEl.textContent = 'Escreve um comentário antes de enviar.';
                return;
            }

            var user = AuthService.getCurrentUser();
            btn.disabled = true;
            AodaBackend.addReview({
                productId: String(productId),
                rating: rating,
                comment: comment,
                customerName: (user && (user.displayName || user.email)) || 'Cliente'
            }).then(function(id) {
                btn.disabled = false;
                if (id) {
                    msgEl.style.color = '#4a5c46';
                    msgEl.textContent = 'Obrigado! A tua avaliação foi enviada e vai aparecer depois de aprovada.';
                    document.getElementById('reviewComment').value = '';
                } else {
                    msgEl.style.color = '#c0392b';
                    msgEl.textContent = 'Não foi possível enviar a avaliação. Tenta novamente.';
                }
            });
        });
    }

    closeProductModal() {
        var modal = document.querySelector('.product-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            setTimeout(function() { modal.remove(); }, 300);
        }
    }

    // ========== Animações ==========
    initializeAnimations() {
        var self = this;
        var observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };

        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, observerOptions);

        document.querySelectorAll('.animate-on-scroll').forEach(function(el) {
            observer.observe(el);
        });
    }

    initializeProductAnimations() {
        var cards = document.querySelectorAll('.product-card');
        cards.forEach(function(card, index) {
            setTimeout(function() {
                card.classList.add('animate-in');
            }, index * 80);
        });
    }

    // ========== Eventos ==========
    bindEvents() {
        var self = this;

        // Filtros por checkbox
        document.addEventListener('change', function(e) {
            if (e.target.classList.contains('filter-checkbox')) {
                var filterType = e.target.dataset.filterType;
                var value = e.target.value;

                if (e.target.checked) {
                    if (self.filters[filterType].indexOf(value) === -1) {
                        self.filters[filterType].push(value);
                    }
                } else {
                    self.filters[filterType] = self.filters[filterType].filter(function(v) { return v !== value; });
                }
                self.applyFilters();
            }
        });

        // Pesquisa
        var searchInput = document.querySelector('.search-input');
        if (searchInput) {
            var debounceTimer;
            searchInput.addEventListener('input', function(e) {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(function() {
                    self.handleSearch(e.target.value);
                }, 250);
            });
        }

        // Fechar modal com Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                self.closeProductModal();
            }
        });
    }

    initializeFilters() {
        var self = this;
        var priceRange = document.querySelector('.price-range-slider');
        if (priceRange) {
            priceRange.addEventListener('input', function(e) {
                self.filters.priceRange[1] = parseInt(e.target.value);
                var display = document.querySelector('.max-price');
                if (display) display.textContent = self.formatPrice(parseInt(e.target.value));
                self.applyFilters();
            });
        }
    }

        // ========== MOBILE MENU ==========
    initMobileMenu() {
        var self = this;
        var backdrop = document.getElementById('mobileBackdrop');
        var menu = document.getElementById('mobileMenu');
        var closeBtn = document.getElementById('mobileClose');

        // Se não existirem elementos, não inicializar (ex: páginas que ainda não têm o HTML)
        if (!backdrop || !menu || !closeBtn) return;

        // Abrir menu (acionado pelo botão hambúrguer)
        document.querySelectorAll('.md\\:hidden button').forEach(function(btn) {
            btn.addEventListener('click', function() {
                self.openMobileMenu();
            });
        });

        // Fechar pelo botão X
        closeBtn.addEventListener('click', function() {
            self.closeMobileMenu();
        });

        // Fechar pelo backdrop
        backdrop.addEventListener('click', function() {
            self.closeMobileMenu();
        });

        // Fechar ao clicar num link
        menu.querySelectorAll('.mobile-menu-link').forEach(function(link) {
            link.addEventListener('click', function() {
                // Pequeno atraso para o utilizador ver o feedback do toque
                setTimeout(function() {
                    self.closeMobileMenu();
                }, 150);
            });
        });

        // Fechar com Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && menu.classList.contains('open')) {
                self.closeMobileMenu();
            }
        });

        // Marcar link ativo
        this.highlightMobileLink();

        // Atualizar badge do carrinho
        this.updateMobileCartBadge();
    }

    openMobileMenu() {
        var backdrop = document.getElementById('mobileBackdrop');
        var menu = document.getElementById('mobileMenu');
        if (!backdrop || !menu) return;

        backdrop.classList.add('open');
        menu.classList.add('open');
        document.body.style.overflow = 'hidden';
        this.updateMobileCartBadge();
    }

    closeMobileMenu() {
        var backdrop = document.getElementById('mobileBackdrop');
        var menu = document.getElementById('mobileMenu');
        if (!backdrop || !menu) return;

        menu.classList.remove('open');
        backdrop.classList.remove('open');
        document.body.style.overflow = '';
    }

    highlightMobileLink() {
        var currentPage = window.location.pathname.split('/').pop() || 'index.html';
        var pageName = currentPage.replace('.html', '');

        document.querySelectorAll('.mobile-menu-link').forEach(function(link) {
            link.classList.remove('active');
            var linkPage = link.getAttribute('data-page');
            if (linkPage === pageName) {
                link.classList.add('active');
            }
        });
    }

    updateMobileCartBadge() {
        var badge = document.getElementById('mobileCartBadge');
        if (!badge) return;
        var total = this.cart.reduce(function(sum, item) { return sum + item.qty; }, 0);
        badge.textContent = total;
        badge.style.display = total > 0 ? 'inline' : 'none';
    }

    loadPageContent() {
        if (document.querySelector('.products-grid')) {
            this.renderProducts(this.products);
        }
        if (document.querySelector('.cart-items')) {
            this.renderCart();
        }
    }
            loadProducts() {
        var container = document.querySelector('.products-grid');
        if (!container) return;

        // Mostrar skeleton enquanto carrega
        var skeletonEl = document.getElementById('productsSkeleton');
        var restoreProducts = SharedUX.showSkeleton(container, SharedUX.renderProductSkeletons(12));

        var self = this;
        
        // Pequeno atraso para o skeleton ser visível
        setTimeout(function() {
            container.innerHTML = '';
            // Se existir conteúdo no container (carregado pelo skeleton), restaurar
            if (skeletonEl) {
                container.appendChild(skeletonEl);
            }
        }, 100);

        // Renderizar produtos reais
        setTimeout(function() {
            if (typeof restoreProducts === 'function') {
                restoreProducts();
            } else {
                self.renderProducts(self.products);
            }
        }, 300);

        this.initializeProductAnimations();
    }
    
}

// Inicializar a aplicação
document.addEventListener('DOMContentLoaded', function() {
    window.app = new AodaStoreApp();
});