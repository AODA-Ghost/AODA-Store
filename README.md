# AODA Store

Loja online (e-commerce) estática em HTML/CSS/JS puro, com backend em Firebase
(Auth, Firestore, Cloud Functions) para autenticação, encomendas, pagamentos
(Multicaixa Express e Stripe) e envio de e-mails transacionais (SendGrid).

---

## Objetivo deste README

Este README explica exatamente o que é necessário para levar o projeto para
produção.

Inclui:
- o que já está pronto
- o que falta configurar
- como criar o primeiro admin
- como deployar o frontend e o backend
- checklist final para produção

---

## 1. O que já está pronto

O código do projeto já tem as principais funcionalidades implementadas:
- autenticação de clientes e administradores via Firebase Auth
- separação de roles `admin` / `customer`
- gestão de produtos, categorias, marcas, banners e cupões no painel admin
- carrinho, checkout e encomendas com Firestore
- integração com Multicaixa Express e Stripe
- envio de e-mail transacional via SendGrid
- regras de segurança Firestore para acesso adequado
- UI responsiva para desktop e mobile

> O que ainda falta para estar em produção não é código: são as configurações
de ambiente, serviços externos e credenciais corretas.

---

## 2. O que é necessário para produção

### 2.1 Pré-requisitos

- Conta Google e projeto Firebase
- Conta SendGrid
- Conta Stripe (se planeares usar Stripe)
- Acesso às credenciais Multicaixa Express
- Node.js 18+
- npm
- `firebase-tools` instalado globalmente

### 2.2 Serviços necessários

- Firebase Authentication
- Firebase Firestore
- Firebase Functions
- Firebase Hosting (ou outro host estático)
- SendGrid
- Multicaixa Express
- Stripe (opcional)

---

## 3. Passos para colocar em produção

### 3.1 Criar e configurar o projeto Firebase

1. Acede a https://console.firebase.google.com e cria um projeto.
2. Ativa em Firebase:
   - Authentication → Email/Password
   - Firestore Database
   - Functions
   - Hosting (se for o host escolhido)
3. Em **Project Settings → Web Apps**, regista uma nova Web App.
4. Copia as credenciais da Web App.
5. Atualiza `firebase-config.js` com os valores reais.

Exemplo de configuração:

```js
var firebaseConfig = {
    apiKey: "AIza...",
    authDomain: "teu-projeto.firebaseapp.com",
    projectId: "teu-projeto",
    storageBucket: "teu-projeto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};
```

> Estes valores NÃO são secretos; é normal que fiquem expostos no browser.

### 3.2 Publicar as regras do Firestore

O ficheiro `firestore.rules` já contém as regras necessárias para proteger as
datasets e permitir os usos esperados.

Executa:

```bash
npm install -g firebase-tools
firebase login
firebase init firestore
firebase deploy --only firestore:rules
```

### 3.3 Configurar e deployar Cloud Functions

No diretório `functions`:

```bash
cd functions
npm install
```

Definir os segredos (secrets):

```bash
firebase functions:secrets:set SENDGRID_API_KEY="SG.xxxxx"
firebase functions:secrets:set MULTICAIXA_TOKEN="xxxx"
firebase functions:secrets:set MULTICAIXA_ENTITY="00100"
firebase functions:secrets:set MULTICAIXA_HMAC_KEY="xxxx"
firebase functions:secrets:set STRIPE_SECRET_KEY="sk_test_xxx"
firebase functions:secrets:set STRIPE_AOA_TO_USD_RATE="0.0012"
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET="whsec_xxx"
```

> Se não usares Stripe, basta não definir `STRIPE_SECRET_KEY` e
> `STRIPE_WEBHOOK_SECRET`.

Faz o deploy das functions:

```bash
firebase deploy --only functions
```

### 3.4 Criar o primeiro administrador

O ficheiro `setup-admin.js` serve para criar a primeira conta de admin.

Passos:
1. Configura `firebase-config.js` com as credenciais reais do projeto.
2. Abre `setup-admin.html` no browser local.
3. Preenche o nome, e-mail e password.
4. Clica em "Criar Administrador".

> Nota: para criar o primeiro admin, pode ser necessário ajustar
> temporariamente `firestore.rules` para permitir criar o documento `users`
> com `role: 'admin'`. Depois de criar o admin, restaura a regra e faz deploy
> novamente.

### 3.5 Deploy do frontend

Podes usar Firebase Hosting ou qualquer outro serviço de hosting estático.

Se usares Firebase Hosting:

```bash
firebase init hosting
firebase deploy --only hosting
```

Se usares outro host estático, faz o upload dos ficheiros do projeto (HTML,
CSS, JS, `firebase-config.js`, etc.) para o serviço.

### 3.6 Testes de produção

Depois do deploy, testa os seguintes fluxos:
- registo e login de cliente em `auth.html`
- login admin via `auth.html?redirect=admin` ou `admin.html`
- criação/update de produtos no admin
- checkout completo
- pagamento Multicaixa Express
- pagamento Stripe (se configurado)
- envio de e-mail transacional
- criação e aprovação de avaliações
- visualização mobile/tablet

---

## 4. Checklist final para produção

- [ ] `firebase-config.js` atualizado com credenciais reais
- [ ] `firestore.rules` publicado
- [ ] Cloud Functions deployadas
- [ ] segredos configurados no Firebase Functions
- [ ] primeiro admin criado
- [ ] frontend publicado em hosting
- [ ] login cliente e admin testados
- [ ] checkout e pagamentos testados
- [ ] envios de e-mail verificados
- [ ] regras Firestore simuladas/testadas
- [ ] responsive em mobile verificado

---

## 5. Organização do código

- `index.html`, `products.html`, `cart.html`, `checkout.html`, `auth.html`, `admin.html`
  → páginas do site
- `main.js`, `admin-app.js`, `setup-admin.js`, `payment-service.js`, `app-backend.js`,
  `auth-service.js`, `email-service.js` → lógica do frontend
- `functions/index.js` → backend de pagamentos, webhooks e e-mails
- `firebase-config.js` → configuração Firebase do frontend
- `firestore.rules` → regras de segurança do Firestore

---

## 6. Observações importantes

- As credenciais de Firebase do browser são públicas por natureza.
- As chaves de `firebase functions:secrets` devem ficar seguras.
- A segurança real está em `firestore.rules`.
- Se usares Multicaixa Express e Stripe, confirma os webhooks no painel de cada
  serviço.
- Stripe só funciona com USD no código atual; o valor AOA é convertido via taxa.

---

## 7. Perguntas frequentes rápidas

### O site já está pronto para produção?
O código está pronto, mas falta configurar o ambiente de produção e os
serviços externos.

### O admin já está inserido?
O sistema suporta a criação do primeiro admin via `setup-admin.html`, mas
não há forma de eu confirmar se já existe um admin no teu Firebase sem
aceder ao teu projeto.

### Preciso alterar código para deployar?
Não, apenas as configurações externas e os serviços necessários.

### Quais serviços externos são obrigatórios?
- Firebase Auth
- Firestore
- Cloud Functions
- SendGrid
- Multicaixa Express

Stripe é opcional, mas recomendado se quiseres aceitar pagamentos via cartão.
