# AODA Store

Loja online (e-commerce) estática em HTML/CSS/JS puro, com backend em Firebase
(Auth, Firestore, Cloud Functions) para autenticação, encomendas, pagamentos
(Multicaixa Express e Stripe) e envio de e-mails transacionais (SendGrid).

---

## 1. Estado atual do projeto

**Esta é a 4ª ronda de trabalho no projeto.** As 3 primeiras rondas foram de
**correção de bugs** (sintaxe, referências quebradas, erros de runtime —
secção 2). Esta 4ª ronda foi de **melhorias funcionais**: liguei partes do
site que existiam mas não estavam realmente conectadas entre si (secção 2b).

**Depois desta ronda: o código está limpo e funcionalmente completo.**
Sintaxe válida em 100% dos ficheiros JS, zero erros de runtime nas 14
páginas testadas num browser real (os únicos "erros" que restam no meu
ambiente de teste são o SDK do Firebase e o Tailwind CDN, que a minha
sandbox de testes bloqueia por segurança — no browser real de qualquer
visitante isso carrega normalmente).

**O que falta para estar "ao vivo" na internet não é código — são as tuas
credenciais e contas**, que só tu podes criar (não tenho acesso a elas):

1. Criar um projeto Firebase real e colar as credenciais em `firebase-config.js`
2. Publicar as `firestore.rules`
3. Criar contas SendGrid / Stripe / Multicaixa Express e configurar as chaves nas Cloud Functions
4. Fazer o deploy (Firebase Hosting, Netlify, Vercel, ou outro)

A secção 3 tem o passo-a-passo exato disto. Sem esses passos, o site abre
mas nada que dependa de dados (login, checkout, e-mails) funciona — porque
ainda aponta para um projeto Firebase de exemplo.

---

## 2. Bugs encontrados e corrigidos nesta ronda (3ª)

### 🔴 Crítico — quebrava TODAS as 14 páginas do site

| Ficheiro(s) | Problema | Correção |
|---|---|---|
| Todos os `.html` | Todas as páginas carregavam `<script src="build-min/bundle.min.js">` — um ficheiro que só existe **depois** de correres `build.sh` manualmente, e que não vem incluído no projeto. Resultado: `main.js` (a classe `AodaStoreApp` inteira — carrinho, filtros, catálogo, tudo) **nunca era carregado em lugar nenhum**. O site não funcionava em nenhuma página, independentemente do Firebase estar ou não configurado. | Todas as 14 páginas passaram a carregar `main.js` diretamente (o ficheiro de desenvolvimento, não minificado). A minificação com `build.sh` continua disponível como passo opcional antes de publicar (secção 3.7). |

### 🟠 Graves

| Ficheiro | Problema | Correção |
|---|---|---|
| `main.js` (`initAuthUI`) | Chamava `AuthService.onAuthStateChanged(...)` sem verificar se `AuthService` existia. Só 3 das 14 páginas carregam `auth-service.js` — nas outras 11, isto lançava um erro não tratado que impedia `window.app` de ser criado, quebrando a app inteira nessas páginas (mesmo padrão do bug do `EmailService` já corrigido antes). | Adicionada verificação `typeof AuthService === 'undefined'` no início da função, com saída segura — mesmo princípio defensivo já aplicado ao `EmailService`. |
| `checkout.html` | Um bloco de código órfão, sobrado de uma reescrita anterior da função `processOrder()`, ficou fora de qualquer função, referenciando variáveis (`orderData`, `btn`) que não existiam nesse escopo. Lançava `ReferenceError` assim que a página carregava, o que impedia o listener de scroll da navbar (efeito de transparência) de ser registado. | Bloco de código morto removido. |
| `contact.html` | `main.js` estava a ser carregado **duas vezes** (uma no `<head>`, outra perto do rodapé) — a segunda execução lançava `SyntaxError: Identifier 'AodaStoreApp' has already been declared`, deixando o comportamento da página dependente de qual das duas cópias corria primeiro. | Removida a segunda ocorrência duplicada. |

### 🟡 Menor

| Ficheiro | Problema | Correção |
|---|---|---|
| `auth.html` | O ícone SVG de "mostrar/ocultar password" tinha um atributo `path d="..."` com coordenadas inválidas/corrompidas — o ícone não renderizava corretamente (3 ocorrências: login, registo, e o JS que troca o ícone ao clicar). | Substituído por um path SVG de "olho" válido. |

> Estes bugs não tinham sido apanhados nas rondas anteriores porque essa
> análise era feita por leitura de código (grep/inspeção manual). Nesta
> ronda usei também `node --check` em todos os ficheiros e scripts inline,
> e testei as 14 páginas num Chromium real headless — daí ter aparecido
> muito mais coisa desta vez, incluindo o bug que quebrava o site inteiro.

### Resumo de todas as 3 rondas de bugs (histórico completo)

Ao todo, desde a primeira análise, foram encontrados e corrigidos **14
bugs**: 3 erros de sintaxe fatais (que impediam ficheiros inteiros de
carregar), 3 bugs de "serviço não definido" que quebravam a app inteira em
certas páginas, 1 falha de segurança (auto-promoção a admin), 1 bug
financeiro (cálculo de valor no Stripe), 1 referência quebrada a
`build-min/bundle.min.js` em todas as páginas, código morto, imagens
partidas e um ícone SVG malformado. Ver a tabela acima para os 5 mais
recentes; os 9 anteriores estão documentados no histórico da conversa.

---

## 2b. Melhorias funcionais implementadas (4ª ronda)

As 3 primeiras rondas garantiram que o código **corria sem erros**. Mas
correr sem erros não é o mesmo que **funcionar como esperado**: o admin
geria produtos, cupões, stock e avaliações — mas a loja nunca lia nada
disso. Esta ronda ligou essas pontas.

### 🔴 Login duplicado unificado
Existiam **duas telas de login** independentes: `auth.html` (clientes) e um
formulário próprio dentro de `admin.html`. Agora só há uma — `auth.html`.
Se abrires `admin.html` sem sessão de administrador, és redirecionado
automaticamente para `auth.html?redirect=admin` com um aviso contextual.
Depois do login, `AuthService.loginAndRedirect()` já decide para onde
mandar cada utilizador consoante o `role`.

### 🔴 Sessão do cliente perdida em `account.html`
Bug real encontrado depois desta ronda: `account.html` verificava se havia
sessão usando `AuthService.getCurrentUser()`, que lê `auth.currentUser` de
forma **síncrona**. O Firebase demora um instante a confirmar uma sessão
guardada ao carregar a página — nesse instante `auth.currentUser` ainda
está vazio. Resultado: **um cliente com sessão válida que atualizasse a
página, ou entrasse diretamente em `account.html` (não logo a seguir ao
login), era incorretamente expulso para `auth.html`.** `main.js` já fazia
isto de forma correta (`AuthService.onAuthStateChanged`, assíncrono) para o
link "Conta" da navbar — só o `account.html` tinha a sua própria lógica
duplicada e incorreta. Corrigido: agora `account.html` espera a
confirmação assíncrona antes de decidir mostrar a conta ou redirecionar.

### 🔴 Catálogo da loja ligado ao Firestore
`main.js` tinha os produtos **hardcoded** num array; o admin gerava
produtos numa coleção `products` no Firestore que a loja nunca lia. Agora
`loadProductsFromFirestore()` busca os produtos ativos ao carregar a
página e substitui o catálogo de reserva automaticamente. Se o Firestore
falhar ou estiver vazio, a loja continua a funcionar com o catálogo
hardcoded como rede de segurança. Também corrigi todas as comparações e
`onclick` que assumiam IDs numéricos (o Firestore usa IDs em string).

### 🟠 Cupões reais no checkout
`cart.html` validava códigos promocionais contra uma lista fixa dentro do
próprio ficheiro (`AODA10`, `FRETE`, `AODA20`), completamente desligada dos
cupões geridos em `admin.html`. Agora `AodaBackend.validateCoupon(code)`
consulta o Firestore (tipo percentagem/valor fixo, validade, limite de
usos) e `incrementCouponUsage()` contabiliza cada uso depois de uma
encomenda confirmada.

### 🟠 Controlo de stock real
Não havia nenhuma verificação de stock no carrinho/checkout — dava para
comprar quantidade infinita de um produto esgotado. Agora:
- `AodaBackend.saveOrder()` corre uma transação que verifica e reserva
  stock antes de confirmar a encomenda, rejeitando com uma mensagem clara
  se não houver unidades suficientes.
- A loja mostra um selo "Esgotado" e desativa a compra quando `stock <= 0`.
- **Nota de segurança:** por omissão, `firestore.rules` só deixa o admin
  escrever em `products`. Para o checkout (cliente comum) poder decrementar
  stock sem dar acesso total de escrita, adicionei uma exceção **restrita**
  à regra: só permite alterar o campo `stock`, só para um valor menor que o
  atual, nunca outros campos. O mesmo foi feito para `usedCount` em
  `coupons` (só permite incrementar em exatamente 1). Vale a pena revalidar
  estas regras no simulador da consola do Firebase antes de publicar.

### 🟡 Avaliações de produto
O admin já moderava avaliações (aprovar/eliminar), mas não existia nenhuma
forma de um cliente **criar** uma avaliação, nem de a loja **exibir** as
aprovadas. Adicionei:
- Formulário de avaliação (estrelas + comentário) no modal de produto em
  `products.html`, visível só para utilizadores autenticados.
- Lista de avaliações aprovadas + média, por produto.
- As avaliações ficam pendentes (`approved: false`) até seres tu a aprovar
  em `admin.html` → separador Avaliações.
- Foi preciso adicionar os SDKs `firebase-auth-compat.js` e
  `auth-service.js` a `products.html` (antes só carregava Firestore, sem
  autenticação).

---

## 3. Como pôr o site a funcionar (passo a passo)

### 3.1 Testar localmente (sem Firebase, só para ver o layout)

Como é HTML/CSS/JS puro, basta servir os ficheiros estaticamente:

```bash
cd AODA
python3 -m http.server 8000
# abrir http://localhost:8000
```

Vais ver o site, mas login, carrinho na nuvem, checkout e admin não vão
funcionar (dependem do Firebase configurado — próximos passos).

### 3.2 Criar e ligar o projeto Firebase

1. Vai a [console.firebase.google.com](https://console.firebase.google.com) → **Criar projeto**
2. No projeto, ativa: **Authentication** (método Email/Password), **Firestore Database** e **Functions**
3. Em **Project Settings → Web Apps**, regista uma nova Web App e copia o objeto de configuração
4. Abre `firebase-config.js` e substitui os valores `"SEU_..."` pelos reais:

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

Estes valores **não são secretos** — identificam o projeto publicamente, e é
normal (e seguro) tê-los visíveis no código do browser. A segurança real é
garantida pelas regras do Firestore, não por esconder isto.

### 3.3 Publicar as regras de segurança do Firestore

```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # aponta para o projeto que criaste
firebase deploy --only firestore:rules
```

> **Nota (4ª ronda):** as regras de `products` e `coupons` têm agora
> exceções restritas para o checkout poder decrementar stock e contabilizar
> uso de cupões sem precisar de privilégios de admin (ver secção 2b). Antes
> de publicar, recomendo simular estas regras na consola do Firebase
> (Firestore → Regras → Simulador) com um utilizador comum, confirmando que
> só é possível alterar exatamente o campo esperado.

### 3.4 Configurar as Cloud Functions (segredos)

As Cloud Functions precisam de chaves que **nunca** devem ir para o código do
browser. Configura-as como variáveis de ambiente do próprio Firebase:

```bash
cd functions
npm install

firebase functions:secrets:set SENDGRID_API_KEY
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
firebase functions:secrets:set MULTICAIXA_TOKEN
firebase functions:secrets:set MULTICAIXA_HMAC_KEY
```

(vais precisar de contas em [SendGrid](https://sendgrid.com), [Stripe](https://stripe.com)
e no fornecedor Multicaixa Express para obteres estas chaves)

### 3.5 Deploy

```bash
firebase deploy --only functions
firebase deploy --only hosting     # se usares Firebase Hosting para o frontend
```

Ou publica os ficheiros HTML/CSS/JS estáticos em qualquer hosting (Netlify,
Vercel, GitHub Pages, cPanel, etc.) — não precisam de servidor Node, são
ficheiros estáticos normais.

### 3.6 Tornar-te admin

Depois de criares a tua conta na página `auth.html`, tens duas opções:

- **Manual (recomendado para produção):** vai à consola do Firebase →
  Firestore → coleção `users` → o teu documento → adiciona manualmente o
  campo `role` com o valor `"admin"`. É proposital que isto só possa ser
  feito pela consola (ver bug de segurança #4 acima).
- **Via `setup-admin.html`:** ferramenta incluída no projeto para promover
  a primeira conta a admin sem abrir a consola do Firebase. Usa-a só na
  configuração inicial e considera removê-la (ou restringir o acesso) depois
  de teres pelo menos um admin criado, para não ficar acessível
  publicamente.

### 3.7 (Opcional) Minificar para produção

```bash
npm install -g clean-css-cli terser
chmod +x build.sh
./build.sh
```

Gera uma versão minificada em `build-min/`. Depois troca manualmente as tags
`<script src="main.js">` / `<link href="shared-ux.css">` pelos ficheiros
minificados nos HTMLs (o próprio script explica os passos no final).

### 3.8 Correr os testes

```bash
node tests/tests.js
```

---

## 4. Estrutura do projeto

```
AODA/
├── index.html, products.html, cart.html, checkout.html, ...   → páginas
├── main.js              → app principal (catálogo, carrinho, filtros, UI)
├── shared-ux.js/.css     → componentes partilhados (breadcrumbs, header, etc.)
├── firebase-config.js    → credenciais do Firebase (preencher, secção 3.2)
├── auth-service.js       → login/registo/perfil (Firebase Auth)
├── app-backend.js        → leitura/escrita no Firestore (produtos, encomendas)
├── payment-service.js    → chama as Cloud Functions de pagamento
├── email-service.js      → templates de e-mail (envio real é via Cloud Function)
├── sw.js                 → service worker (cache offline)
├── firestore.rules       → regras de segurança da base de dados
├── functions/
│   ├── index.js          → Cloud Functions (Multicaixa, Stripe, e-mails, limpeza)
│   └── package.json
├── tests/tests.js        → testes unitários básicos (sem dependências)
├── build.sh              → script de minificação para produção
└── resources/            → imagens
```

---

## 5. Recomendações e opções futuras

### Curto prazo (antes de lançar)
- **Adotar Git** (`git init`, commits regulares). É a forma mais eficaz de
  evitar que bugs já corrigidos voltem a aparecer, como aconteceu várias
  vezes nesta conversa.
- Substituir as imagens de produto atuais (que parecem ser de sneakers/lã)
  pelas fotos reais da AODA, já que os textos e preços já são de t-shirts.
- Testar o fluxo de checkout ponta-a-ponta com o Stripe em modo teste, e o
  Multicaixa Express em sandbox, antes de aceitar pagamentos reais —
  incluindo o novo fluxo de reserva de stock (secção 2b).
- Rever a taxa de câmbio fixa AOA→USD usada no Stripe (`0.0012` por omissão)
  — está hardcoded como fallback; vale a pena atualizá-la periodicamente ou
  ligar a uma API de câmbio.
- Simular as novas exceções em `firestore.rules` (stock e `usedCount`) no
  simulador da consola do Firebase antes de publicar (ver nota na secção 3.3).

### Médio prazo
- **CI simples**: um GitHub Action que corre `node --check` em todos os `.js`
  e `node tests/tests.js` a cada push, para apanhar erros de sintaxe
  automaticamente antes de irem para produção.
- E-mail automático ao cliente quando o admin muda o estado de uma
  encomenda (hoje o SendGrid só é chamado no momento do checkout; mudar o
  estado depois, em `admin.html`, não notifica o cliente).
- Adicionar paginação/lazy-loading de imagens em `products.html` se o
  catálogo crescer.
- Mostrar a avaliação média do produto também no cartão da grelha
  (`products-grid`), não só dentro do modal — ajuda na decisão de compra
  sem precisar de abrir cada produto.

### Longo prazo
- Avaliar migrar de HTML+JS “vanilla” para um framework (Next.js, Astro, ou
  similar) se o projeto continuar a crescer — facilita reaproveitar
  componentes entre páginas em vez de duplicar HTML em cada ficheiro.
- Programa de fidelização mais avançado (cupões automáticos por
  aniversário, primeira compra, etc.) — a base de cupões já existe.
- App mobile ou PWA instalável — o `sw.js` já dá a base de cache offline;
  falta o manifest.json e ícones para tornar o site instalável como app.
- Analytics (Google Analytics ou Firebase Analytics) para perceber taxa de
  abandono de carrinho e conversão no checkout.
