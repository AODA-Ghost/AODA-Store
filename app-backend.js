// app-backend.js
// Camada de dados — CRUD para TODAS as coleções do Firestore

var AodaBackend = {

    // ==========================================
    // ENCOMENDAS
    // ==========================================
    // Guarda a encomenda. Antes de gravar, se os itens do carrinho
    // corresponderem a produtos reais do Firestore com stock definido,
    // verifica e reserva esse stock numa transação — impede vender mais
    // unidades do que as disponíveis. Itens sem produto correspondente no
    // Firestore (ex: catálogo de reserva) ou sem campo "stock" são ignorados
    // nesta verificação.
    saveOrder: function(orderData) {
        var user = auth.currentUser;
        if (user) orderData.userId = user.uid;

        var items = (orderData.items || []).filter(function(it) { return it && it.id; });

        var stockCheck = items.length ? db.runTransaction(function(tx) {
            var refs = items.map(function(it) { return db.collection('products').doc(String(it.id)); });
            return Promise.all(refs.map(function(ref) { return tx.get(ref); })).then(function(docs) {
                // 1ª passagem: valida se há stock suficiente para todos os itens
                docs.forEach(function(doc, i) {
                    if (!doc.exists) return;
                    var data = doc.data();
                    if (typeof data.stock !== 'number') return;
                    var wanted = items[i].qty || 1;
                    if (data.stock < wanted) {
                        var err = new Error('Sem stock suficiente para "' + (data.name || 'produto') + '" (disponível: ' + data.stock + ').');
                        err.code = 'out_of_stock';
                        throw err;
                    }
                });
                // 2ª passagem: só decrementa depois de confirmar que tudo está ok
                docs.forEach(function(doc, i) {
                    if (!doc.exists) return;
                    var data = doc.data();
                    if (typeof data.stock !== 'number') return;
                    tx.update(refs[i], { stock: data.stock - (items[i].qty || 1) });
                });
            });
        }) : Promise.resolve();

        return stockCheck.then(function() {
            return db.collection('orders').add(Object.assign({}, orderData, {
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            })).then(function(docRef) {
                return docRef.id;
            }).catch(function(error) {
                console.error('[Backend] Encomenda não foi guardada no Firestore (stock já reservado):', error);
                return 'local-' + Date.now();
            });
        });
        // Nota: se stockCheck rejeitar (sem stock suficiente), esta promise
        // rejeita também — o checkout.html mostra o erro ao cliente e não
        // decrementa stock nem cria a encomenda.
    },

    getOrders: function() {
        return db.collection('orders').orderBy('createdAt', 'desc').get().then(function(snapshot) {
            return snapshot.docs.map(function(doc) {
                return Object.assign({ id: doc.id }, doc.data(), {
                    date: doc.data().createdAt ? doc.data().createdAt.toDate() : new Date()
                });
            });
        }).catch(function() { return []; });
    },

    getOrdersByUser: function(uid) {
        return db.collection('orders').where('userId', '==', uid).orderBy('createdAt', 'desc').limit(20).get().then(function(snapshot) {
            return snapshot.docs.map(function(doc) {
                return Object.assign({ id: doc.id }, doc.data());
            });
        }).catch(function() { return []; });
    },

    updateOrderStatus: function(orderId, newStatus) {
        return db.collection('orders').doc(orderId).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(function() { return true; }).catch(function() { return false; });
    },

    deleteOrder: function(orderId) {
        return db.collection('orders').doc(orderId).delete().then(function() { return true; }).catch(function() { return false; });
    },

    // ==========================================
    // PRODUTOS
    // ==========================================
    getProducts: function() {
        return db.collection('products').orderBy('createdAt', 'desc').get().then(function(snapshot) {
            return snapshot.docs.map(function(doc) { return Object.assign({ id: doc.id }, doc.data()); });
        }).catch(function() { return []; });
    },

    getActiveProducts: function() {
        return db.collection('products').where('active', '==', true).get().then(function(snapshot) {
            return snapshot.docs.map(function(doc) { return Object.assign({ id: doc.id }, doc.data()); });
        }).catch(function() { return []; });
    },

    addProduct: function(data) {
        return db.collection('products').add(Object.assign({}, data, {
            active: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            stock: data.stock || 0
        })).then(function(docRef) { return docRef.id; }).catch(function() { return null; });
    },

    updateProduct: function(productId, data) {
        return db.collection('products').doc(productId).update(data).then(function() { return true; }).catch(function() { return false; });
    },

    deleteProduct: function(productId) {
        return db.collection('products').doc(productId).delete().then(function() { return true; }).catch(function() { return false; });
    },

    toggleProductActive: function(productId, isActive) {
        return db.collection('products').doc(productId).update({ active: isActive }).then(function() { return true; }).catch(function() { return false; });
    },

    // ==========================================
    // CATEGORIAS
    // ==========================================
    getCategories: function() {
        return db.collection('categories').orderBy('name').get().then(function(snapshot) {
            return snapshot.docs.map(function(doc) { return Object.assign({ id: doc.id }, doc.data()); });
        }).catch(function() { return []; });
    },

    addCategory: function(data) {
        return db.collection('categories').add(Object.assign({}, data, {
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        })).then(function(ref) { return ref.id; }).catch(function() { return null; });
    },

    updateCategory: function(id, data) {
        return db.collection('categories').doc(id).update(data).then(function() { return true; }).catch(function() { return false; });
    },

    deleteCategory: function(id) {
        return db.collection('categories').doc(id).delete().then(function() { return true; }).catch(function() { return false; });
    },

    // ==========================================
    // MARCAS
    // ==========================================
    getBrands: function() {
        return db.collection('brands').orderBy('name').get().then(function(snapshot) {
            return snapshot.docs.map(function(doc) { return Object.assign({ id: doc.id }, doc.data()); });
        }).catch(function() { return []; });
    },

    addBrand: function(data) {
        return db.collection('brands').add(Object.assign({}, data, {
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        })).then(function(ref) { return ref.id; }).catch(function() { return null; });
    },

    updateBrand: function(id, data) {
        return db.collection('brands').doc(id).update(data).then(function() { return true; }).catch(function() { return false; });
    },

    deleteBrand: function(id) {
        return db.collection('brands').doc(id).delete().then(function() { return true; }).catch(function() { return false; });
    },

    // ==========================================
    // CLIENTES
    // ==========================================
    getCustomers: function() {
        return db.collection('users').where('role', '==', 'customer').orderBy('createdAt', 'desc').get().then(function(snapshot) {
            return snapshot.docs.map(function(doc) { return Object.assign({ id: doc.id, uid: doc.id }, doc.data()); });
        }).catch(function() { return []; });
    },

    // ==========================================
    // UTILIZADORES (Admins)
    // ==========================================
    getAdmins: function() {
        return db.collection('users').where('role', '==', 'admin').orderBy('createdAt', 'desc').get().then(function(snapshot) {
            return snapshot.docs.map(function(doc) { return Object.assign({ id: doc.id, uid: doc.id }, doc.data()); });
        }).catch(function() { return []; });
    },

    getAllUsers: function() {
        return db.collection('users').orderBy('createdAt', 'desc').get().then(function(snapshot) {
            return snapshot.docs.map(function(doc) { return Object.assign({ id: doc.id, uid: doc.id }, doc.data()); });
        }).catch(function() { return []; });
    },

    updateUserRole: function(uid, newRole) {
        return db.collection('users').doc(uid).update({ role: newRole }).then(function() { return true; }).catch(function() { return false; });
    },

    deleteUser: function(uid) {
        return db.collection('users').doc(uid).delete().then(function() { return true; }).catch(function() { return false; });
    },

    // ==========================================
    // CUPÕES / PROMOÇÕES
    // ==========================================
    getCoupons: function() {
        return db.collection('coupons').orderBy('createdAt', 'desc').get().then(function(snapshot) {
            return snapshot.docs.map(function(doc) { return Object.assign({ id: doc.id }, doc.data()); });
        }).catch(function() { return []; });
    },

    addCoupon: function(data) {
        return db.collection('coupons').add(Object.assign({}, data, {
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            usedCount: 0,
            active: true
        })).then(function(ref) { return ref.id; }).catch(function() { return null; });
    },

    updateCoupon: function(id, data) {
        return db.collection('coupons').doc(id).update(data).then(function() { return true; }).catch(function() { return false; });
    },

    deleteCoupon: function(id) {
        return db.collection('coupons').doc(id).delete().then(function() { return true; }).catch(function() { return false; });
    },

    // Valida um código de cupão introduzido pelo cliente no carrinho.
    // Verifica: existe, está ativo, ainda não expirou, ainda não atingiu o
    // limite de usos. Devolve o cupão (com id) se válido, ou null.
    validateCoupon: function(code) {
        if (!code) return Promise.resolve(null);
        return db.collection('coupons').where('code', '==', code.trim().toUpperCase()).limit(1).get()
            .then(function(snapshot) {
                if (snapshot.empty) return null;
                var doc = snapshot.docs[0];
                var c = Object.assign({ id: doc.id }, doc.data());

                if (c.active === false) return null;
                if (c.validUntil) {
                    var expiry = new Date(c.validUntil + 'T23:59:59');
                    if (!isNaN(expiry.getTime()) && expiry < new Date()) return null;
                }
                if (c.maxUses && (c.usedCount || 0) >= c.maxUses) return null;

                return c;
            })
            .catch(function() { return null; });
    },

    // Chamado depois de uma encomenda com cupão ser confirmada, para
    // contabilizar o uso e respeitar o limite maxUses no futuro.
    incrementCouponUsage: function(couponId) {
        if (!couponId) return Promise.resolve(false);
        return db.collection('coupons').doc(couponId).update({
            usedCount: firebase.firestore.FieldValue.increment(1)
        }).then(function() { return true; }).catch(function() { return false; });
    },

    // ==========================================
    // BANNERS
    // ==========================================
    getBanners: function() {
        return db.collection('banners').orderBy('order', 'asc').get().then(function(snapshot) {
            return snapshot.docs.map(function(doc) { return Object.assign({ id: doc.id }, doc.data()); });
        }).catch(function() { return []; });
    },

    addBanner: function(data) {
        return db.collection('banners').add(Object.assign({}, data, {
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            active: true
        })).then(function(ref) { return ref.id; }).catch(function() { return null; });
    },

    updateBanner: function(id, data) {
        return db.collection('banners').doc(id).update(data).then(function() { return true; }).catch(function() { return false; });
    },

    deleteBanner: function(id) {
        return db.collection('banners').doc(id).delete().then(function() { return true; }).catch(function() { return false; });
    },

    // ==========================================
    // AVALIAÇÕES
    // ==========================================
    getReviews: function() {
        return db.collection('reviews').orderBy('createdAt', 'desc').get().then(function(snapshot) {
            return snapshot.docs.map(function(doc) { return Object.assign({ id: doc.id }, doc.data()); });
        }).catch(function() { return []; });
    },

    updateReview: function(id, data) {
        return db.collection('reviews').doc(id).update(data).then(function() { return true; }).catch(function() { return false; });
    },

    deleteReview: function(id) {
        return db.collection('reviews').doc(id).delete().then(function() { return true; }).catch(function() { return false; });
    },

    // Avaliações aprovadas de um produto específico, para exibir na loja.
    // (sem orderBy no servidor para não exigir índice composto — ordena no cliente)
    getReviewsByProduct: function(productId) {
        return db.collection('reviews')
            .where('productId', '==', String(productId))
            .where('approved', '==', true)
            .get()
            .then(function(snapshot) {
                var list = snapshot.docs.map(function(doc) { return Object.assign({ id: doc.id }, doc.data()); });
                list.sort(function(a, b) {
                    var ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
                    var tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
                    return tb - ta;
                });
                return list;
            })
            .catch(function() { return []; });
    },

    // Cria uma avaliação (fica pendente — só aparece na loja depois de
    // aprovada pelo admin em admin.html → separador Avaliações).
    addReview: function(data) {
        var user = auth.currentUser;
        return db.collection('reviews').add(Object.assign({}, data, {
            userId: user ? user.uid : null,
            approved: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        })).then(function(ref) { return ref.id; }).catch(function() { return null; });
    },

    // ==========================================
    // CONTACTOS
    // ==========================================
    getContacts: function() {
        return db.collection('contacts').orderBy('createdAt', 'desc').get().then(function(snapshot) {
            return snapshot.docs.map(function(doc) { return Object.assign({ id: doc.id }, doc.data()); });
        }).catch(function() { return []; });
    },

    updateContact: function(id, data) {
        return db.collection('contacts').doc(id).update(data).then(function() { return true; }).catch(function() { return false; });
    },

    deleteContact: function(id) {
        return db.collection('contacts').doc(id).delete().then(function() { return true; }).catch(function() { return false; });
    },

    // ==========================================
    // NEWSLETTER
    // ==========================================
    subscribeEmail: function(email) {
        return db.collection('newsletter').where('email', '==', email).get().then(function(existing) {
            if (!existing.empty) return 'already_subscribed';
            return db.collection('newsletter').add({
                email: email,
                subscribedAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(function() { return 'success'; });
        }).catch(function() { return 'error'; });
    },

    getNewsletter: function() {
        return db.collection('newsletter').orderBy('subscribedAt', 'desc').get().then(function(snapshot) {
            return snapshot.docs.map(function(doc) { return Object.assign({ id: doc.id }, doc.data()); });
        }).catch(function() { return []; });
    },

    // ==========================================
    // CONFIGURAÇÕES DA LOJA
    // ==========================================
    getSettings: function() {
        return db.collection('settings').doc('store').get().then(function(doc) {
            return doc.exists ? Object.assign({ id: doc.id }, doc.data()) : null;
        }).catch(function() { return null; });
    },

    saveSettings: function(data) {
        return db.collection('settings').doc('store').set(Object.assign({}, data, {
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }), { merge: true }).then(function() { return true; }).catch(function() { return false; });
    },

    // ==========================================
    // DASHBOARD STATS
    // ==========================================
    getDashboardStats: function() {
        var stats = { totalCustomers: 0, totalOrders: 0, totalProducts: 0, totalRevenue: 0, lowStock: 0, pendingOrders: 0, recentOrders: [] };

        var p1 = db.collection('users').where('role', '==', 'customer').get().then(function(s) { stats.totalCustomers = s.size; });
        var p2 = db.collection('orders').get().then(function(s) {
            stats.totalOrders = s.size;
            s.docs.forEach(function(doc) {
                var d = doc.data();
                if (d.totals && d.totals.total) stats.totalRevenue += d.totals.total;
                if (d.status === 'pending') stats.pendingOrders++;
            });
        });
        var p3 = db.collection('products').get().then(function(s) {
            stats.totalProducts = s.size;
            s.docs.forEach(function(doc) {
                if (doc.data().stock !== undefined && doc.data().stock < 5) stats.lowStock++;
            });
        });
        var p4 = db.collection('orders').orderBy('createdAt', 'desc').limit(5).get().then(function(s) {
            stats.recentOrders = s.docs.map(function(doc) {
                return Object.assign({ id: doc.id }, doc.data(), { date: doc.data().createdAt ? doc.data().createdAt.toDate() : null });
            });
        });

        return Promise.all([p1, p2, p3, p4]).then(function() { return stats; });
    }
};