// setup-admin.js
// Criar o primeiro administrador
// INSTRUÇÕES:
// 1. Configura firebase-config.js com credenciais reais
// 2. Abre setup-admin.html no browser
// 3. Preenche e-mail + password + nome
// 4. Clica "Criar Administrador"
// 5. IMPORTANTE: Temporariamente altera firestore.rules para permitir create com role:
//    Muda:  allow create: if isAuthenticated() && uid == request.auth.uid && !('role' in request.resource.data);
//    Para:  allow create: if isAuthenticated() && uid == request.auth.uid;
//    Depois de criar, RESTAURA a regra original e faz deploy.

document.addEventListener('DOMContentLoaded', function() {
    if (typeof firebase === 'undefined' || typeof db === 'undefined') {
        showResult('Erro: Firebase não configurado.', 'error'); return;
    }
    if (firebaseConfig.apiKey === 'SEU_API_KEY_AQUI') {
        showResult('Erro: Configura o firebase-config.js primeiro.', 'error'); return;
    }
    showResult('Pronto. Preenche os campos para criar o administrador.', 'info');
});

async function createAdmin(e) {
    e.preventDefault();
    var name = document.getElementById('sName').value.trim();
    var email = document.getElementById('sEmail').value.trim();
    var pw = document.getElementById('sPassword').value;
    var btn = document.getElementById('sBtn');

    if (!name || !email || !pw) { showResult('Preenche todos os campos.', 'error'); return; }
    if (pw.length < 6) { showResult('Mínimo 6 caracteres.', 'error'); return; }

    btn.disabled = true; btn.textContent = 'A criar...';

    try {
        showResult('A criar conta...', 'info');
        var cred = await auth.createUserWithEmailAndPassword(email, pw);
        await cred.user.updateProfile({ displayName: name });
        showResult('A definir role de administrador...', 'info');
        await db.collection('users').doc(cred.user.uid).set({
            name: name, email: email, role: 'admin',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
        showResult('Administrador criado com sucesso! Faz login em auth.html ou admin.html com: ' + email, 'success');
        await auth.signOut();
        btn.textContent = 'Administrador Criado!'; btn.disabled = true;
    } catch (error) {
        var msgs = {
            'auth/email-already-in-use': 'E-mail já registado. Se já é admin, faz login. Se queres promover, edita o documento /users/{uid} no Firebase Console e adiciona role: "admin".',
            'auth/weak-password': 'Palavra-passe fraca.',
            'auth/permission-denied': 'Permissão negada. Altera temporariamente as firestore.rules (ver instruções na página).'
        };
        showResult('Erro: ' + (msgs[error.code] || error.message), 'error');
        btn.disabled = false; btn.textContent = 'Criar Administrador';
    }
}

function showResult(t, type) {
    var el = document.getElementById('sResult');
    el.textContent = t;
    el.className = 'sr ' + (type || '');
}