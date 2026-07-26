// firebase-config.js
// Configuração do Firebase
//
// Para configurar:
// 1. Cria um projeto em https://console.firebase.google.com
// 2. Regista a Web App e copia as credenciais (Project Settings → Web Apps)
// 3. Substitui os valores abaixo pelas tuas credenciais reais
//
// NOTA: estes valores NÃO são secretos — são identificadores públicos do teu
// projeto Firebase e é normal e seguro tê-los visíveis no código do browser.
// A segurança real vem das Regras do Firestore (firestore.rules), não daqui.
// Por isso este ficheiro pode ficar tal como está, sem variáveis de ambiente
// (que não existem no browser — só existem em Node.js/servidor).
var firebaseConfig = {
    apiKey: "SEU_API_KEY_AQUI",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO_ID",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
};

// Verificar se as credenciais foram configuradas
var isConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "SEU_API_KEY_AQUI";

if (!isConfigured) {
    console.warn(
        '[Firebase] Credenciais de exemplo detetadas. ' +
        'Substitui os valores em firebase-config.js pelas credenciais reais do teu projeto Firebase. ' +
        'Consulte: https://console.firebase.google.com → Project Settings → Web Apps'
    );
}

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referências globais
var db = firebase.firestore();
var auth = firebase.auth();