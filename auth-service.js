// auth-service.js
// Autenticação via Firebase Auth + roles no Firestore

var AuthService = {

    // ==========================================
    // REGISTO (apenas clientes)
    // ==========================================
    register: function(name, email, password, phone) {
        return auth.createUserWithEmailAndPassword(email, password)
            .then(function(credential) {
                return credential.user.updateProfile({ displayName: name });
            })
            .then(function() {
                var user = auth.currentUser;
                var data = {
                    name: name,
                    email: user.email,
                    role: 'customer',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                };
                if (phone) data.phone = phone.replace(/\s/g, '');
                return db.collection('users').doc(user.uid).set(data);
            })
            .then(function() {
                return { success: true };
            })
            .catch(function(error) {
                return { success: false, error: mapAuthError(error.code) };
            });
    },

    // ==========================================
    // LOGIN UNIFICADO — redireciona por role
    // ==========================================
    login: function(email, password) {
        return auth.signInWithEmailAndPassword(email, password)
            .then(function() {
                var user = auth.currentUser;
                // Atualizar lastLogin
                db.collection('users').doc(user.uid).update({
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(function() {});
                return { success: true, uid: user.uid };
            })
            .catch(function(error) {
                return { success: false, error: mapAuthError(error.code) };
            });
    },

    // ==========================================
    // VERIFICAR ROLE
    // ==========================================
    checkUserRole: function(uid) {
        if (!uid) uid = auth.currentUser ? auth.currentUser.uid : null;
        if (!uid) return Promise.resolve({ role: null });

        return db.collection('users').doc(uid).get().then(function(doc) {
            if (doc.exists) {
                var data = doc.data();
                return { role: data.role || 'customer', data: data };
            }
            return { role: 'customer', data: null };
        }).catch(function() {
            return { role: null };
        });
    },

    isAdmin: function(uid) {
        return this.checkUserRole(uid).then(function(r) { return r.role === 'admin'; });
    },

    // ==========================================
    // LOGIN + REDIRECIONAR AUTOMATICAMENTE
    // ==========================================
    loginAndRedirect: function(email, password) {
        var self = this;
        return self.login(email, password).then(function(result) {
            if (!result.success) return result;
            return self.checkUserRole(result.uid).then(function(roleResult) {
                var role = roleResult.role;
                if (role === 'admin') {
                    return { success: true, redirect: 'admin.html', role: 'admin' };
                } else if (role === 'customer') {
                    return { success: true, redirect: 'account.html', role: 'customer' };
                } else {
                    return { success: false, error: 'Perfil sem role definida. Contacta o suporte.' };
                }
            });
        });
    },

    // ==========================================
    // LOGOUT
    // ==========================================
    logout: function() {
        return auth.signOut().then(function() {
            return { success: true };
        });
    },

    // ==========================================
    // RESET PASSWORD
    // ==========================================
    resetPassword: function(email) {
        return auth.sendPasswordResetEmail(email)
            .then(function() {
                return { success: true, message: 'E-mail de reset enviado. Verifica a tua caixa de entrada.' };
            })
            .catch(function(error) {
                return { success: false, error: mapAuthError(error.code) };
            });
    },

    // ==========================================
    // PERFIL
    // ==========================================
    updateProfile: function(displayName, phone) {
        var user = auth.currentUser;
        if (!user) return Promise.resolve({ success: false, error: 'Não autenticado' });

        var promise = Promise.resolve();
        if (displayName) {
            promise = user.updateProfile({ displayName: displayName });
        }

        return promise.then(function() {
            var updateData = { updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
            if (displayName) updateData.name = displayName;
            if (phone) updateData.phone = phone.replace(/\s/g, '');
            return db.collection('users').doc(user.uid).set(updateData, { merge: true });
        }).then(function() {
            return { success: true };
        }).catch(function() {
            return { success: false, error: 'Erro ao atualizar perfil' };
        });
    },

    deleteAccount: function(password) {
        var user = auth.currentUser;
        if (!user) return Promise.resolve({ success: false, error: 'Não autenticado' });
        var credential = auth.EmailAuthProvider.credential(user.email, password);
        return user.reauthenticateWithCredential(credential).then(function() {
            return user.delete();
        }).then(function() {
            return db.collection('users').doc(user.uid).delete();
        }).then(function() {
            return { success: true };
        }).catch(function(error) {
            return { success: false, error: mapAuthError(error.code) };
        });
    },

    getCurrentUser: function() {
        var user = auth.currentUser;
        if (!user) return null;
        return { uid: user.uid, name: user.displayName, email: user.email, phone: user.phoneNumber, emailVerified: user.emailVerified };
    },

    onAuthStateChanged: function(callback) {
        auth.onAuthStateChanged(function(user) {
            if (user) {
                callback({ loggedIn: true, uid: user.uid, name: user.displayName, email: user.email });
            } else {
                callback({ loggedIn: false });
            }
        });
    },

    getUserData: function(uid) {
        if (!uid) uid = auth.currentUser ? auth.currentUser.uid : null;
        if (!uid) return Promise.resolve(null);
        return db.collection('users').doc(uid).get().then(function(doc) {
            return doc.exists ? doc.data() : null;
        }).catch(function() { return null; });
    }
};

// ==========================================
// MAPEAR ERROS DO FIREBASE AUTH
// ==========================================
function mapAuthError(code) {
    var map = {
        'auth/email-already-in-use': 'Este e-mail já está registado.',
        'auth/weak-password': 'A palavra-passe deve ter pelo menos 6 caracteres.',
        'auth/invalid-email': 'Endereço de e-mail inválido.',
        'auth/too-many-requests': 'Muitas tentativas. Tenta novamente dentro de alguns minutos.',
        'auth/user-not-found': 'Não existe conta com este e-mail.',
        'auth/wrong-password': 'Palavra-passe incorreta.',
        'auth/invalid-credential': 'E-mail ou palavra-passe incorretos.',
        'auth/requires-recent-login': 'Sessão expirada. Faz login novamente.'
    };
    return map[code] || 'Erro de autenticação.';
}