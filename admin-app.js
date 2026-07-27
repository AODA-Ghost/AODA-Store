// admin-app.js
// Lógica completa do painel administrativo AODA Store

var AdminApp = {

    // ==========================================
    // INIT
    // ==========================================
    // Não existe formulário de login próprio do admin — a autenticação é
    // sempre feita em auth.html (tela única para clientes e administradores).
    // Aqui só verificamos se já há sessão ativa e se é admin:
    //   - sem sessão            → redireciona para auth.html
    //   - sessão de cliente     → redireciona para auth.html (sem acesso)
    //   - sessão de admin       → mostra o dashboard
    init: function() {
        var self = this;
        auth.onAuthStateChanged(async function(user) {
            if (!user) {
                window.location.href = 'auth.html?redirect=admin';
                return;
            }
            var isAdmin = await AuthService.isAdmin(user.uid);
            if (!isAdmin) {
                document.getElementById('loginError').textContent =
                    'Esta conta não tem privilégios de administrador. A redirecionar…';
                await AuthService.logout();
                setTimeout(function() {
                    window.location.href = 'auth.html?redirect=admin';
                }, 1500);
                return;
            }
            document.getElementById('adminEmailDisplay').textContent = user.email;
            self.showDashboard();
        });
    },

    showDashboard: function() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'flex';
        this.loadAll();
    },

    handleLogout: function() {
        AuthService.logout().then(function() {
            window.location.href = 'auth.html';
        });
    },

    // ==========================================
    // TABS
    // ==========================================
    switchTab: function(name, linkEl) {
        document.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('active'); });
        document.querySelectorAll('.sidebar-nav a').forEach(function(a) { a.classList.remove('active'); });
        var tab = document.getElementById('tab-' + name);
        if (tab) tab.classList.add('active');
        if (linkEl) linkEl.classList.add('active');
        var titles = { dashboard:'Dashboard', products:'Produtos', orders:'Encomendas', customers:'Clientes', users:'Utilizadores', categories:'Categorias', brands:'Marcas', promotions:'Promoções', stock:'Stock', banners:'Banners', reviews:'Avaliações', contacts:'Contactos', settings:'Configurações', newsletter:'Newsletter' };
        document.getElementById('pageTitle').textContent = titles[name] || '';
        document.getElementById('adminSidebar').classList.remove('open');

        // Lazy load
        if (name === 'dashboard') this.loadDashboard();
        if (name === 'products') this.loadProducts();
        if (name === 'orders') this.loadOrders();
        if (name === 'customers') this.loadCustomers();
        if (name === 'users') this.loadUsers();
        if (name === 'categories') this.loadCategories();
        if (name === 'brands') this.loadBrands();
        if (name === 'promotions') this.loadPromotions();
        if (name === 'stock') this.loadStock();
        if (name === 'banners') this.loadBanners();
        if (name === 'reviews') this.loadReviews();
        if (name === 'contacts') this.loadContacts();
        if (name === 'settings') this.loadSettings();
        if (name === 'newsletter') this.loadNewsletter();
    },

    loadAll: function() {
        this.loadDashboard();
        this.loadOrders();
        this.loadProducts();
        this.loadNewsletter();
    },

    // ==========================================
    // DASHBOARD
    // ==========================================
    loadDashboard: function() {
        var self = this;
        AodaBackend.getDashboardStats().then(function(stats) {
            document.getElementById('statCustomers').textContent = stats.totalCustomers;
            document.getElementById('statOrders').textContent = stats.totalOrders;
            document.getElementById('statProducts').textContent = stats.totalProducts;
            document.getElementById('statRevenue').textContent = formatKz(stats.totalRevenue);
            document.getElementById('statLowStock').textContent = stats.lowStock;
            document.getElementById('statPending').textContent = stats.pendingOrders;

            // Últimas encomendas
            var tb = document.getElementById('recentOrdersBody');
            if (stats.recentOrders.length === 0) {
                tb.innerHTML = '<tr><td colspan="5" class="empty-td">Sem encomendas recentes</td></tr>';
            } else {
                var sLabels = { pending:'Pendente', processing:'Confirmado', shipped:'Enviado', delivered:'Entregue', cancelled:'Cancelado' };
                tb.innerHTML = stats.recentOrders.map(function(o) {
                    return '<tr><td><strong>' + (o.id||'').substring(0,8) + '</strong></td>' +
                        '<td>' + (o.customer ? o.customer.name : '-') + '</td>' +
                        '<td>' + formatKz(o.totals ? o.totals.total : 0) + '</td>' +
                        '<td><span class="status-badge status-' + (o.status||'pending') + '">' + (sLabels[o.status]||o.status) + '</span></td>' +
                        '<td>' + (o.date ? o.date.toLocaleDateString('pt-AO') : '-') + '</td></tr>';
                }).join('');
            }
        });
    },

    // ==========================================
    // PRODUTOS
    // ==========================================
    loadProducts: function() {
        var self = this;
        AodaBackend.getProducts().then(function(products) {
            var statsDiv = document.getElementById('productsStats');
            var activeCount = products.filter(function(p) { return p.active !== false; }).length;
            var totalStock = products.reduce(function(s,p) { return s + (p.stock || 0); }, 0);
            statsDiv.innerHTML =
                '<div class="stat-card"><div class="stat-label">Total</div><div class="stat-value">' + products.length + '</div></div>' +
                '<div class="stat-card"><div class="stat-label">Ativos</div><div class="stat-value sage">' + activeCount + '</div></div>' +
                '<div class="stat-card"><div class="stat-label">Stock Total</div><div class="stat-value">' + totalStock + '</div></div>';

            var tbody = document.getElementById('productsTableBody');
            if (products.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><p>Nenhum produto. Clica em "+ Novo Produto" para começar.</p></div></td></tr>';
                return;
            }
            tbody.innerHTML = products.map(function(p) {
                var img = p.images && p.images.length > 0 ? p.images[0] : (p.image || 'resources/favicon.svg');
                var isActive = p.active !== false;
                return '<tr>' +
                    '<td><img class="product-thumb" src="' + img + '" alt="" onerror="this.src=\'resources/favicon.svg\'"></td>' +
                    '<td><strong>' + escHtml(p.name) + '</strong><br><small style="color:#999;">' + escHtml(p.sku || '') + '</small></td>' +
                    '<td>' + escHtml(p.brand || '-') + '</td>' +
                    '<td>' + formatKz(p.price) + (p.salePrice ? '<br><small style="color:#ff6b6b;text-decoration:line-through;">' + formatKz(p.price) + '</small> ' + formatKz(p.salePrice) : '') + '</td>' +
                    '<td>' + (p.stock !== undefined ? '<span class="' + (p.stock < 5 ? 'text-red' : '') + '">' + p.stock + '</span>' : '-') + '</td>' +
                    '<td><span class="status-badge ' + (isActive ? 'status-delivered' : 'status-cancelled') + '">' + (isActive ? 'Ativo' : 'Inativo') + '</span></td>' +
                    '<td><div class="action-btns">' +
                        '<button class="btn-sm" onclick="AdminApp.openProductModal(\'' + p.id + '\')">Editar</button>' +
                        '<button class="btn-sm" onclick="AdminApp.toggleProduct(\'' + p.id + '\',' + !isActive + ')">' + (isActive ? 'Desativar' : 'Ativar') + '</button>' +
                        '<button class="btn-sm danger" onclick="AdminApp.deleteProduct(\'' + p.id + '\')">Eliminar</button>' +
                    '</div></td></tr>';
            }).join('');
        });
    },

    openProductModal: function(editId) {
        this._editProductId = editId || null;
        var modal = document.getElementById('productModal');
        var form = document.getElementById('productForm');
        form.reset();
        document.getElementById('imagePreviewContainer').innerHTML = '';
        this._productImages = [];

        if (editId) {
            document.getElementById('productModalTitle').textContent = 'Editar Produto';
            document.getElementById('productSubmitBtn').textContent = 'Guardar Alterações';
            // Load product data
            db.collection('products').doc(editId).get().then(function(doc) {
                if (!doc.exists) return;
                var p = doc.data();
                document.getElementById('pName').value = p.name || '';
                document.getElementById('pBrand').value = p.brand || '';
                document.getElementById('pCategory').value = p.category || '';
                document.getElementById('pDescription').value = p.description || '';
                document.getElementById('pPrice').value = p.price || '';
                document.getElementById('pSalePrice').value = p.salePrice || '';
                document.getElementById('pStock').value = p.stock !== undefined ? p.stock : '';
                document.getElementById('pColor').value = p.color || '';
                document.getElementById('pSizes').value = p.sizes ? (Array.isArray(p.sizes) ? p.sizes.join(', ') : p.sizes) : '';
                document.getElementById('pSku').value = p.sku || '';
                document.getElementById('pWeight').value = p.weight || '';
                document.getElementById('pFeatured').checked = !!p.featured;
                document.getElementById('pActive').checked = p.active !== false;
                if (p.images && p.images.length > 0) {
                    AdminApp._productImages = p.images.slice();
                    AdminApp.renderImagePreviews();
                } else if (p.image) {
                    AdminApp._productImages = [p.image];
                    AdminApp.renderImagePreviews();
                }
            });
        } else {
            document.getElementById('productModalTitle').textContent = 'Novo Produto';
            document.getElementById('productSubmitBtn').textContent = 'Adicionar Produto';
        }
        modal.style.display = 'flex';
    },

    closeProductModal: function() {
        document.getElementById('productModal').style.display = 'none';
        this._editProductId = null;
        this._productImages = [];
    },

    _productImages: [],

    addImageToProduct: function(input) {
        var self = this;
        if (!input.files || !input.files[0]) return;
        var file = input.files[0];
        if (file.size > 2 * 1024 * 1024) { showToast('Imagem demasiado grande (máx 2MB)', 'error'); return; }

        // Tentar Firebase Storage, se disponível
        if (typeof storage !== 'undefined') {
            var ref = storage.ref('products/' + Date.now() + '_' + file.name);
            var task = ref.put(file);
            showToast('A fazer upload...', 'info');
            task.on('state_changed', null, function(err) {
                showToast('Erro no upload: ' + err.message, 'error');
            }, function() {
                task.snapshot.ref.getDownloadURL().then(function(url) {
                    self._productImages.push(url);
                    self.renderImagePreviews();
                    showToast('Imagem carregada', 'success');
                });
            });
        } else {
            // Fallback: base64
            var reader = new FileReader();
            reader.onload = function(e) {
                self._productImages.push(e.target.result);
                self.renderImagePreviews();
            };
            reader.readAsDataURL(file);
        }
        input.value = '';
    },

    addImageUrlToProduct: function() {
        var url = document.getElementById('pImageUrl').value.trim();
        if (!url) return;
        this._productImages.push(url);
        this.renderImagePreviews();
        document.getElementById('pImageUrl').value = '';
    },

    removeProductImage: function(index) {
        this._productImages.splice(index, 1);
        this.renderImagePreviews();
    },

    renderImagePreviews: function() {
        var container = document.getElementById('imagePreviewContainer');
        container.innerHTML = this._productImages.map(function(url, i) {
            return '<div class="img-preview-item"><img src="' + url + '" alt="" onerror="this.src=\'resources/favicon.svg\'">' +
                '<button type="button" class="img-remove-btn" onclick="AdminApp.removeProductImage(' + i + ')">&times;</button></div>';
        }).join('');
    },

    handleProductSubmit: function(e) {
        e.preventDefault();
        var self = this;
        var btn = document.getElementById('productSubmitBtn');
        btn.disabled = true;

        var sizesRaw = document.getElementById('pSizes').value.trim();
        var sizes = sizesRaw ? sizesRaw.split(',').map(function(s) { return s.trim().toUpperCase(); }).filter(Boolean) : [];

        var data = {
            name: document.getElementById('pName').value.trim(),
            brand: document.getElementById('pBrand').value.trim(),
            category: document.getElementById('pCategory').value.trim(),
            description: document.getElementById('pDescription').value.trim(),
            price: parseInt(document.getElementById('pPrice').value) || 0,
            salePrice: parseInt(document.getElementById('pSalePrice').value) || null,
            stock: parseInt(document.getElementById('pStock').value) || 0,
            color: document.getElementById('pColor').value.trim(),
            sizes: sizes,
            sku: document.getElementById('pSku').value.trim(),
            weight: parseFloat(document.getElementById('pWeight').value) || null,
            featured: document.getElementById('pFeatured').checked,
            active: document.getElementById('pActive').checked,
            images: this._productImages,
            image: this._productImages.length > 0 ? this._productImages[0] : '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        var promise;
        if (this._editProductId) {
            promise = AodaBackend.updateProduct(this._editProductId, data);
        } else {
            promise = AodaBackend.addProduct(data);
        }

        promise.then(function(result) {
            if (result) {
                showToast(self._editProductId ? 'Produto atualizado' : 'Produto adicionado', 'success');
                self.closeProductModal();
                self.loadProducts();
            } else {
                showToast('Erro ao guardar produto', 'error');
            }
            btn.disabled = false;
        });
    },

    toggleProduct: function(id, state) {
        AodaBackend.toggleProductActive(id, state).then(function() {
            showToast(state ? 'Produto ativado' : 'Produto desativado', 'success');
            AdminApp.loadProducts();
        });
    },

    deleteProduct: function(id) {
        if (!confirm('Eliminar este produto?')) return;
        AodaBackend.deleteProduct(id).then(function() {
            showToast('Produto eliminado', 'success');
            AdminApp.loadProducts();
        });
    },

    syncProducts: function() {
        if (!window.app || !app.products) { showToast('Produtos do site não encontrados', 'error'); return; }
        var count = 0;
        app.products.forEach(function(p) {
            AodaBackend.updateProduct('product-' + p.id, Object.assign({}, p, { active: true }));
            count++;
        });
        showToast(count + ' produtos sincronizados', 'success');
        this.loadProducts();
    },

    // ==========================================
    // ENCOMENDAS
    // ==========================================
    loadOrders: function() {
        AodaBackend.getOrders().then(function(orders) {
            var sLabels = { pending:'Pendente', processing:'Confirmado', shipped:'Enviado', delivered:'Entregue', cancelled:'Cancelado' };
            var statsDiv = document.getElementById('ordersStats');
            var revenue = 0, pending = 0;
            orders.forEach(function(o) { if (o.totals) revenue += o.totals.total; if (o.status === 'pending') pending++; });
            statsDiv.innerHTML =
                '<div class="stat-card"><div class="stat-label">Total</div><div class="stat-value">' + orders.length + '</div></div>' +
                '<div class="stat-card"><div class="stat-label">Pendentes</div><div class="stat-value sage">' + pending + '</div></div>' +
                '<div class="stat-card"><div class="stat-label">Receita</div><div class="stat-value sage">' + formatKz(revenue) + '</div></div>';

            var tbody = document.getElementById('ordersTableBody');
            if (orders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><p>Nenhuma encomenda</p></div></td></tr>';
                return;
            }
            tbody.innerHTML = orders.map(function(o) {
                var itemCount = o.items ? o.items.reduce(function(s,i){return s+i.qty;},0) : 0;
                return '<tr>' +
                    '<td><strong>' + (o.id||'').substring(0,8) + '</strong></td>' +
                    '<td>' + escHtml(o.customer ? o.customer.name : '-') + '</td>' +
                    '<td>' + escHtml(o.customer ? o.customer.phone : '-') + '</td>' +
                    '<td>' + itemCount + '</td>' +
                    '<td><strong>' + formatKz(o.totals ? o.totals.total : 0) + '</strong></td>' +
                    '<td>' + escHtml(o.payment || '-') + '</td>' +
                    '<td><select class="status-select" onchange="AdminApp.changeOrderStatus(\'' + o.id + '\',this.value)">' +
                        ['pending','processing','shipped','delivered','cancelled'].map(function(s) {
                            return '<option value="'+s+'"'+(o.status===s?' selected':'')+'>'+sLabels[s]+'</option>';
                        }).join('') + '</select></td>' +
                    '<td>' + (o.date ? o.date.toLocaleDateString('pt-AO') : '-') + '</td>' +
                    '<td><button class="btn-sm danger" onclick="AdminApp.deleteOrder(\'' + o.id + '\')">Eliminar</button></td></tr>';
            }).join('');
        });
    },

    changeOrderStatus: function(id, status) {
        AodaBackend.updateOrderStatus(id, status).then(function(ok) {
            showToast(ok ? 'Estado atualizado' : 'Erro', ok ? 'success' : 'error');
            AdminApp.loadOrders();
        });
    },

    deleteOrder: function(id) {
        if (!confirm('Eliminar esta encomenda?')) return;
        AodaBackend.deleteOrder(id).then(function() { showToast('Eliminada','success'); AdminApp.loadOrders(); });
    },

    // ==========================================
    // CLIENTES
    // ==========================================
    loadCustomers: function() {
        AodaBackend.getCustomers().then(function(customers) {
            var tbody = document.getElementById('customersTableBody');
            if (customers.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><p>Nenhum cliente registado</p></div></td></tr>';
                return;
            }
            tbody.innerHTML = customers.map(function(c) {
                return '<tr>' +
                    '<td>' + escHtml(c.name || '-') + '</td>' +
                    '<td>' + escHtml(c.email || '-') + '</td>' +
                    '<td>' + escHtml(c.phone || '-') + '</td>' +
                    '<td>' + (c.createdAt ? c.createdAt.toDate().toLocaleDateString('pt-AO') : '-') + '</td>' +
                    '<td>' + (c.lastLogin ? c.lastLogin.toDate().toLocaleDateString('pt-AO') : '-') + '</td>' +
                    '<td><span class="status-badge status-delivered">Cliente</span></td></tr>';
            }).join('');
        });
    },

    // ==========================================
    // UTILIZADORES (Admins)
    // ==========================================
    loadUsers: function() {
        AodaBackend.getAllUsers().then(function(users) {
            var tbody = document.getElementById('usersTableBody');
            if (users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><p>Nenhum utilizador</p></div></td></tr>';
                return;
            }
            tbody.innerHTML = users.map(function(u) {
                var isAdmin = u.role === 'admin';
                return '<tr>' +
                    '<td>' + escHtml(u.name || '-') + '</td>' +
                    '<td>' + escHtml(u.email || '-') + '</td>' +
                    '<td><span class="status-badge ' + (isAdmin ? 'status-delivered' : 'status-pending') + '">' + (isAdmin ? 'Admin' : 'Cliente') + '</span></td>' +
                    '<td>' + (u.createdAt ? u.createdAt.toDate().toLocaleDateString('pt-AO') : '-') + '</td>' +
                    '<td><div class="action-btns">' +
                        '<button class="btn-sm" onclick="AdminApp.changeUserRole(\'' + u.id + '\',\'' + (isAdmin ? 'customer' : 'admin') + '\')">' + (isAdmin ? 'Remover Admin' : 'Tornar Admin') + '</button>' +
                        (!isAdmin ? '<button class="btn-sm danger" onclick="AdminApp.deleteUser(\'' + u.id + '\')">Eliminar</button>' : '') +
                    '</div></td></tr>';
            }).join('');
        });
    },

    changeUserRole: function(uid, newRole) {
        if (!confirm('Alterar o role deste utilizador para "' + newRole + '"?')) return;
        AodaBackend.updateUserRole(uid, newRole).then(function(ok) {
            showToast(ok ? 'Role atualizado' : 'Erro', ok ? 'success' : 'error');
            AdminApp.loadUsers();
        });
    },

    deleteUser: function(uid) {
        if (!confirm('Eliminar este utilizador?')) return;
        AodaBackend.deleteUser(uid).then(function() { showToast('Eliminado','success'); AdminApp.loadUsers(); });
    },

    // ==========================================
    // CATEGORIAS
    // ==========================================
    loadCategories: function() {
        AodaBackend.getCategories().then(function(items) {
            var tbody = document.getElementById('categoriesTableBody');
            if (items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><p>Nenhuma categoria</p></div></td></tr>';
                return;
            }
            tbody.innerHTML = items.map(function(c) {
                return '<tr><td>' + escHtml(c.name) + '</td><td>' + escHtml(c.description || '-') + '</td><td>' + (c.productCount || 0) + '</td>' +
                    '<td><div class="action-btns"><button class="btn-sm danger" onclick="AdminApp.deleteCategory(\'' + c.id + '\')">Eliminar</button></div></td></tr>';
            }).join('');
        });
    },

    handleAddCategory: function(e) {
        e.preventDefault();
        var name = document.getElementById('catName').value.trim();
        var desc = document.getElementById('catDesc').value.trim();
        if (!name) return;
        AodaBackend.addCategory({ name: name, description: desc }).then(function(id) {
            if (id) { showToast('Categoria criada', 'success'); document.getElementById('categoryForm').reset(); AdminApp.loadCategories(); }
            else showToast('Erro', 'error');
        });
    },

    deleteCategory: function(id) {
        if (!confirm('Eliminar esta categoria?')) return;
        AodaBackend.deleteCategory(id).then(function() { showToast('Eliminada','success'); AdminApp.loadCategories(); });
    },

    // ==========================================
    // MARCAS
    // ==========================================
    loadBrands: function() {
        AodaBackend.getBrands().then(function(items) {
            var tbody = document.getElementById('brandsTableBody');
            if (items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><p>Nenhuma marca</p></div></td></tr>';
                return;
            }
            tbody.innerHTML = items.map(function(b) {
                return '<tr><td>' + escHtml(b.name) + '</td><td>' + escHtml(b.description || '-') + '</td><td>' + (b.productCount || 0) + '</td>' +
                    '<td><button class="btn-sm danger" onclick="AdminApp.deleteBrand(\'' + b.id + '\')">Eliminar</button></td></tr>';
            }).join('');
        });
    },

    handleAddBrand: function(e) {
        e.preventDefault();
        var name = document.getElementById('brandName').value.trim();
        var desc = document.getElementById('brandDesc').value.trim();
        if (!name) return;
        AodaBackend.addBrand({ name: name, description: desc }).then(function(id) {
            if (id) { showToast('Marca criada', 'success'); document.getElementById('brandForm').reset(); AdminApp.loadBrands(); }
            else showToast('Erro', 'error');
        });
    },

    deleteBrand: function(id) {
        if (!confirm('Eliminar esta marca?')) return;
        AodaBackend.deleteBrand(id).then(function() { showToast('Eliminada','success'); AdminApp.loadBrands(); });
    },

    // ==========================================
    // PROMOÇÕES
    // ==========================================
    loadPromotions: function() {
        AodaBackend.getCoupons().then(function(items) {
            var tbody = document.getElementById('promotionsTableBody');
            if (items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><p>Nenhuma promoção</p></div></td></tr>';
                return;
            }
            tbody.innerHTML = items.map(function(c) {
                return '<tr><td><strong>' + escHtml(c.code) + '</strong></td><td>' + (c.type === 'percentage' ? c.value + '%' : formatKz(c.value)) + '</td>' +
                    '<td>' + escHtml(c.description || '-') + '</td><td>' + (c.minPurchase ? formatKz(c.minPurchase) : '-') + '</td>' +
                    '<td><span class="status-badge ' + (c.active !== false ? 'status-delivered' : 'status-cancelled') + '">' + (c.active !== false ? 'Ativo' : 'Inativo') + '</span></td>' +
                    '<td><button class="btn-sm danger" onclick="AdminApp.deleteCoupon(\'' + c.id + '\')">Eliminar</button></td></tr>';
            }).join('');
        });
    },

    handleAddCoupon: function(e) {
        e.preventDefault();
        var data = {
            code: document.getElementById('coupCode').value.trim().toUpperCase(),
            type: document.getElementById('coupType').value,
            value: parseInt(document.getElementById('coupValue').value) || 0,
            description: document.getElementById('coupDesc').value.trim(),
            minPurchase: parseInt(document.getElementById('coupMin').value) || null,
            maxUses: parseInt(document.getElementById('coupMaxUses').value) || null,
            validUntil: document.getElementById('coupExpiry').value || null
        };
        if (!data.code || !data.value) { showToast('Preenche código e valor', 'error'); return; }
        AodaBackend.addCoupon(data).then(function(id) {
            if (id) { showToast('Cupão criado', 'success'); document.getElementById('couponForm').reset(); AdminApp.loadPromotions(); }
            else showToast('Erro', 'error');
        });
    },

    deleteCoupon: function(id) {
        if (!confirm('Eliminar este cupão?')) return;
        AodaBackend.deleteCoupon(id).then(function() { showToast('Eliminado','success'); AdminApp.loadPromotions(); });
    },

    // ==========================================
    // STOCK
    // ==========================================
    loadStock: function() {
        AodaBackend.getProducts().then(function(products) {
            var lowStock = products.filter(function(p) { return p.stock !== undefined && p.stock < 5; });
            var outOfStock = products.filter(function(p) { return p.stock !== undefined && p.stock === 0; });

            document.getElementById('lowStockCount').textContent = lowStock.length;
            document.getElementById('outOfStockCount').textContent = outOfStock.length;

            var tbody = document.getElementById('stockTableBody');
            if (lowStock.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><p>Todo o stock está acima de 5 unidades</p></div></td></tr>';
                return;
            }
            tbody.innerHTML = lowStock.map(function(p) {
                return '<tr><td>' + escHtml(p.name) + '</td><td>' + escHtml(p.sku || '-') + '</td>' +
                    '<td><span class="' + (p.stock === 0 ? 'status-badge status-cancelled' : 'status-badge status-pending') + '">' + p.stock + ' unidades</span></td>' +
                    '<td><input type="number" class="stock-input" value="' + p.stock + '" min="0" style="width:80px;padding:0.3rem;border:1px solid #ddd;border-radius:6px;font-family:inherit;"> ' +
                    '<button class="btn-sm primary" onclick="AdminApp.updateStock(\'' + p.id + '\', this.previousElementSibling.value)">Atualizar</button></td></tr>';
            }).join('');
        });
    },

    updateStock: function(id, newStock) {
        AodaBackend.updateProduct(id, { stock: parseInt(newStock) || 0 }).then(function() {
            showToast('Stock atualizado', 'success');
            AdminApp.loadStock();
        });
    },

    // ==========================================
    // BANNERS
    // ==========================================
    loadBanners: function() {
        AodaBackend.getBanners().then(function(banners) {
            var tbody = document.getElementById('bannersTableBody');
            if (banners.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><p>Nenhum banner</p></div></td></tr>';
                return;
            }
            tbody.innerHTML = banners.map(function(b) {
                return '<tr><td><img class="product-thumb" src="' + (b.image || '') + '" alt="" onerror="this.src=\'resources/favicon.svg\'"></td>' +
                    '<td>' + escHtml(b.title || '-') + '</td><td>' + escHtml(b.link || '-') + '</td>' +
                    '<td><span class="status-badge ' + (b.active !== false ? 'status-delivered' : 'status-cancelled') + '">' + (b.position || 'hero') + '</span></td>' +
                    '<td><button class="btn-sm danger" onclick="AdminApp.deleteBanner(\'' + b.id + '\')">Eliminar</button></td></tr>';
            }).join('');
        });
    },

    handleAddBanner: function(e) {
        e.preventDefault();
        var data = {
            title: document.getElementById('banTitle').value.trim(),
            link: document.getElementById('banLink').value.trim(),
            position: document.getElementById('banPosition').value,
            image: this._bannerImage || '',
            active: true,
            order: parseInt(document.getElementById('banOrder').value) || 0
        };
        if (!data.image) { showToast('Adiciona uma imagem', 'error'); return; }
        AodaBackend.addBanner(data).then(function(id) {
            if (id) { showToast('Banner adicionado', 'success'); document.getElementById('bannerForm').reset(); AdminApp.loadBanners(); }
            else showToast('Erro', 'error');
        });
    },

    // Sobe a imagem para o Firebase Storage (mesmo padrão de
    // addImageToProduct), guardando só o URL no Firestore, em vez de gravar
    // a imagem inteira em base64 dentro do documento do banner.
    handleBannerImage: function(input) {
        var self = this;
        if (!input.files || !input.files[0]) return;
        var file = input.files[0];
        if (file.size > 2 * 1024 * 1024) { showToast('Imagem demasiado grande (máx 2MB)', 'error'); return; }

        // Tentar Firebase Storage, se disponível
        if (typeof storage !== 'undefined') {
            var ref = storage.ref('banners/' + Date.now() + '_' + file.name);
            var task = ref.put(file);
            showToast('A fazer upload...', 'info');
            task.on('state_changed', null, function(err) {
                showToast('Erro no upload: ' + err.message, 'error');
            }, function() {
                task.snapshot.ref.getDownloadURL().then(function(url) {
                    self._bannerImage = url;
                    document.getElementById('bannerPreview').src = url;
                    document.getElementById('bannerPreview').style.display = 'block';
                    showToast('Imagem carregada', 'success');
                });
            });
        } else {
            // Fallback: base64 (só se o Storage não estiver configurado)
            var reader = new FileReader();
            reader.onload = function(e) {
                self._bannerImage = e.target.result;
                document.getElementById('bannerPreview').src = e.target.result;
                document.getElementById('bannerPreview').style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
        input.value = '';
    },

    deleteBanner: function(id) {
        if (!confirm('Eliminar este banner?')) return;
        AodaBackend.deleteBanner(id).then(function() { showToast('Eliminado','success'); AdminApp.loadBanners(); });
    },

    // ==========================================
    // AVALIAÇÕES
    // ==========================================
    loadReviews: function() {
        AodaBackend.getReviews().then(function(reviews) {
            var tbody = document.getElementById('reviewsTableBody');
            if (reviews.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><p>Nenhuma avaliação</p></div></td></tr>';
                return;
            }
            tbody.innerHTML = reviews.map(function(r) {
                var stars = '';
                for (var i = 1; i <= 5; i++) stars += i <= (r.rating||0) ? '★' : '☆';
                return '<tr><td>' + escHtml(r.userName || '-') + '</td><td>' + escHtml(r.productName || '-') + '</td>' +
                    '<td style="color:#f59e0b;">' + stars + '</td>' +
                    '<td>' + escHtml((r.comment || '').substring(0,60)) + '...</td>' +
                    '<td><span class="status-badge ' + (r.approved !== false ? 'status-delivered' : 'status-cancelled') + '">' + (r.approved !== false ? 'Aprovada' : 'Pendente') + '</span></td>' +
                    '<td><div class="action-btns">' +
                        '<button class="btn-sm" onclick="AdminApp.approveReview(\'' + r.id + '\')">Aprovar</button>' +
                        '<button class="btn-sm danger" onclick="AdminApp.deleteReview(\'' + r.id + '\')">Eliminar</button></div></td></tr>';
            }).join('');
        });
    },

    approveReview: function(id) {
        AodaBackend.updateReview(id, { approved: true }).then(function() {
            showToast('Avaliação aprovada', 'success'); AdminApp.loadReviews();
        });
    },

    deleteReview: function(id) {
        if (!confirm('Eliminar esta avaliação?')) return;
        AodaBackend.deleteReview(id).then(function() { showToast('Eliminada','success'); AdminApp.loadReviews(); });
    },

    // ==========================================
    // CONTACTOS
    // ==========================================
    loadContacts: function() {
        AodaBackend.getContacts().then(function(contacts) {
            var tbody = document.getElementById('contactsTableBody');
            if (contacts.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><p>Nenhuma mensagem</p></div></td></tr>';
                return;
            }
            tbody.innerHTML = contacts.map(function(c) {
                return '<tr><td>' + escHtml(c.name || '-') + '</td><td>' + escHtml(c.email || '-') + '</td>' +
                    '<td>' + escHtml((c.message || '').substring(0,50)) + '...</td>' +
                    '<td>' + (c.archived ? '<span class="status-badge status-cancelled">Arquivada</span>' : '<span class="status-badge status-delivered">Nova</span>') + '</td>' +
                    '<td>' + (c.createdAt ? c.createdAt.toDate().toLocaleDateString('pt-AO') : '-') + '</td>' +
                    '<td><div class="action-btns">' +
                        '<button class="btn-sm" onclick="AdminApp.archiveContact(\'' + c.id + '\',' + !c.archived + ')">' + (c.archived ? 'Desarquivar' : 'Arquivar') + '</button>' +
                        '<button class="btn-sm danger" onclick="AdminApp.deleteContact(\'' + c.id + '\')">Eliminar</button></div></td></tr>';
            }).join('');
        });
    },

    archiveContact: function(id, archived) {
        AodaBackend.updateContact(id, { archived: archived }).then(function() {
            showToast(archived ? 'Arquivada' : 'Desarquivada', 'success'); AdminApp.loadContacts();
        });
    },

    deleteContact: function(id) {
        if (!confirm('Eliminar esta mensagem?')) return;
        AodaBackend.deleteContact(id).then(function() { showToast('Eliminada','success'); AdminApp.loadContacts(); });
    },

    // ==========================================
    // CONFIGURAÇÕES
    // ==========================================
    loadSettings: function() {
        AodaBackend.getSettings().then(function(settings) {
            if (!settings) return;
            document.getElementById('setName').value = settings.storeName || '';
            document.getElementById('setPhone').value = settings.phone || '';
            document.getElementById('setEmail').value = settings.email || '';
            document.getElementById('setAddress').value = settings.address || '';
            document.getElementById('setCurrency').value = settings.currency || 'AOA';
            document.getElementById('setVat').value = settings.vat !== undefined ? settings.vat : '';
            document.getElementById('setInstagram').value = settings.instagram || '';
            document.getElementById('setFacebook').value = settings.facebook || '';
            document.getElementById('setPolicy').value = settings.returnPolicy || '';
        });
    },

    handleSaveSettings: function(e) {
        e.preventDefault();
        var data = {
            storeName: document.getElementById('setName').value.trim(),
            phone: document.getElementById('setPhone').value.trim(),
            email: document.getElementById('setEmail').value.trim(),
            address: document.getElementById('setAddress').value.trim(),
            currency: document.getElementById('setCurrency').value,
            vat: parseFloat(document.getElementById('setVat').value) || 0,
            instagram: document.getElementById('setInstagram').value.trim(),
            facebook: document.getElementById('setFacebook').value.trim(),
            returnPolicy: document.getElementById('setPolicy').value.trim()
        };
        AodaBackend.saveSettings(data).then(function(ok) {
            showToast(ok ? 'Configurações guardadas' : 'Erro', ok ? 'success' : 'error');
        });
    },

    // ==========================================
    // NEWSLETTER
    // ==========================================
    loadNewsletter: function() {
        AodaBackend.getNewsletter().then(function(subs) {
            document.getElementById('newsletterCount').textContent = subs.length;
            var tbody = document.getElementById('newsletterTableBody');
            if (subs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="2"><div class="empty-state"><p>Nenhum subscritor</p></div></td></tr>';
            } else {
                tbody.innerHTML = subs.map(function(s) {
                    return '<tr><td>' + escHtml(s.email) + '</td><td>' + (s.subscribedAt ? s.subscribedAt.toDate().toLocaleDateString('pt-AO') : '-') + '</td></tr>';
                }).join('');
            }
        });
    }
};

// ==========================================
// UTILITÁRIOS GLOBAIS
// ==========================================
function formatKz(num) {
    if (typeof num !== 'number') return num || '-';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Kz';
}

function escHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function showToast(message, type) {
    var toast = document.getElementById('adminToast');
    toast.textContent = message;
    toast.className = 'admin-toast ' + (type || '') + ' show';
    setTimeout(function() { toast.classList.remove('show'); }, 3500);
}