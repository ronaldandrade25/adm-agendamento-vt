# ADM Agendamento — Barbearia

Painel administrativo (**gestão e agenda**) para uma **barbearia**.

> **Importante:** este projeto é apenas a parte de **gestão e agenda**. O **site de agendamento** (usado pelos clientes) fica em **outra pasta/projeto**. Os dois se comunicam através do **mesmo projeto Firebase (Firestore)**: ao configurar este painel e o site de agendamento com o **mesmo `firebaseConfig`**, tudo o que o cliente agenda aparece aqui em tempo real, e tudo o que é configurado aqui (profissionais, serviços, horários, bloqueios) é lido pelo site.

```
 Site de agendamento  <──►  Firebase (Firestore + Storage)  <──►  Este painel (ADM)
   (outra pasta)              mesmo projeto / mesmas coleções
```

## Funcionalidades (abas)

- **Agenda**: visualização por dia/profissional, novo agendamento, bloqueios e pausas, mensagem de confirmação para o cliente
- **Link de agendamento**: abrir/copiar o link do site de agendamento
- **Clientes**: cadastro e histórico
- **PDV**: vendas de serviços e produtos
- **Relatórios**: faturamento e gráficos
- **Contas a pagar**: controle de despesas
- **Configurações**: profissionais (com foto), serviços, produtos, horários e exceções

## Tecnologias

- HTML, CSS e JavaScript puro (ES Modules), sem build e sem `npm install`
- Firebase **Firestore** e **Storage** (SDK 10.12.2 via CDN `gstatic`)
- Chart.js (gráficos dos relatórios) e Boxicons (ícones), via CDN
- Firebase Authentication (e-mail/senha) para o login do administrador (ver passo 5)

## Estrutura

| Arquivo | Função |
|---|---|
| `index.html` | Layout, abas e modais |
| `firebase.js` | **Configuração do Firebase**, helpers, modal, abas e estado compartilhado |
| `agenda.js` | Agenda, horários e agendamentos |
| `clientes.js` | Cadastro de clientes |
| `pdv.js` | Vendas / PDV |
| `relatorios.js` | Relatórios e gráficos |
| `configuracoes.js` | Profissionais, serviços, produtos, horários e exceções |
| `contasapagar.js` | Contas a pagar |
| `style.css` | Estilos |

## Como integrar com o Firebase

### 1. Criar/usar o projeto Firebase
1. Acesse o [Firebase Console](https://console.firebase.google.com/) e crie um projeto (ou use o existente).
2. Ative o **Firestore Database** (*Build → Firestore Database → Create database*).
3. Ative o **Storage** (usado no upload de foto do profissional).
4. Em *Project settings → Your apps*, registre um app **Web (`</>`)** e copie o objeto `firebaseConfig`.

### 2. Colar a configuração neste painel
Edite o arquivo [`firebase.js`](firebase.js) e substitua o objeto `firebaseConfig`:

```js
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};
```

Projeto Firebase atualmente configurado: **`barbearia-agenda-fe2a7`**.

### 3. Sincronizar com o site de agendamento
No projeto do **site de agendamento** ([`site-agendamento-vt`](../site-agendamento-vt), arquivo `script.js`), use **exatamente o mesmo `firebaseConfig`** deste `firebase.js` (principalmente o `projectId`) e as **mesmas coleções**. Hoje o `firebaseConfig` está com **campos vazios** nos dois: crie/escolha o projeto Firebase e cole os mesmos valores em ambos.

Fluxo de dados:
- **ADM grava** → `profissionais`, `servicos`, `config/*` (horários, semana, exceções) → **site lê**
- **Site grava** → `reservas_<profissional>/{AAAA-MM-DD_HH:mm}` → **ADM lê** na Agenda (o ID é data + hora; o ADM deve usar o mesmo padrão)

**Cadastro de profissionais (fonte única):** o site **não tem imagens nem lista fixa de profissionais**. Tudo vem de **Configurações → Profissionais** deste painel (coleção `profissionais`): `nome`, `fotoUrl`, `whatsapp`, `colecao` (ex.: `reservas_nome`, obrigatório), `fimExpediente` e `diasFolga`. Cadastrar, editar, trocar a foto ou remover aqui reflete automaticamente no site.

### 4. Coleções usadas no Firestore

| Coleção / documento | Conteúdo |
|---|---|
| `profissionais` | Profissionais; cada um tem o campo `colecao` (ex.: `reservas_nome`) |
| `reservas_<profissional>` | Agendamentos de cada profissional (coleção definida no campo `colecao`) |
| `servicos` | Serviços oferecidos |
| `produtos` | Produtos/estoque |
| `config/horarios`, `config/semana`, `config/excecoes` | Horários de funcionamento, semana e exceções/bloqueios |
| `pdv_sales`, `vendas` | Vendas do PDV |
| `raclub_clients`, `raclub_payments` | Clientes e pagamentos |
| `despesas` | Despesas |
| `contas_apagar`, `rabarbearia_expenses` | Contas a pagar / despesas |

> As coleções de agendamento são criadas dinamicamente a partir do campo `colecao` de cada profissional; o site de agendamento deve gravar nessa mesma coleção.

### 5. Login com Firebase Authentication (e-mail e senha)

Para proteger o painel, use o método **E-mail/senha** do Firebase Authentication:

1. No Firebase Console, vá em **Build → Authentication → Get started**.
2. Na aba **Sign-in method**, clique em **E-mail/senha**, ative **Email/Password** e salve.
3. Cadastre o usuário administrador: aba **Users → Add user**, informe o **e-mail** e a **senha** e confirme. (Só quem estiver cadastrado aqui consegue entrar.)
4. Em **Authentication → Settings → Authorized domains**, adicione o domínio onde o painel for publicado (ex.: `seu-painel.vercel.app`). `localhost` já vem autorizado.
5. No código, importe o Auth no `firebase.js` (mesma versão do SDK) e use o login por e-mail e senha:

```js
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export const auth = getAuth(app);

// Login
await signInWithEmailAndPassword(auth, email, senha);

// Proteger o painel: mostrar a tela de login se não houver usuário
onAuthStateChanged(auth, (user) => {
  if (user) { /* iniciar o painel */ } else { /* mostrar login */ }
});

// Sair
await signOut(auth);
```

> **Nota:** a tela de login já está implementada (`index.html` + `firebase.js`). O site de agendamento **não** precisa de login do cliente, apenas o painel.

#### O e-mail cadastrado também precisa estar nas regras

Criar o usuário no Authentication **não basta**. O login só protege os dados de verdade se o **mesmo e-mail** estiver nas **regras do Firestore e do Storage**. Sem isso, qualquer pessoa que conheça o `firebaseConfig` (ele fica público no navegador) consegue ler/gravar direto no banco, sem passar pelo painel.

As regras prontas estão em [`regras.md`](regras.md) (Firestore e Storage). Troque `SEU_EMAIL_ADMIN@exemplo.com` pelo e-mail do administrador e publique em *Firestore Database → Rules* e *Storage → Rules*.

O que as regras fazem:
- **Leitura pública** de `config`, `servicos` e `profissionais` (o site de agendamento precisa ler), mas **escrita só do admin**.
- **`reservas_*`**: o site (cliente, sem login) lê, cria, remarca e cancela; o admin pode tudo. A criação valida `data` (AAAA-MM-DD) e `hora` (HH:mm) e impede sobrescrever um horário já existente.
- **Todo o resto** (clientes, PDV, vendas, despesas, contas a pagar, produtos, RA Club...) é **somente do admin** logado.
- **Storage**: leitura pública das fotos; upload só do admin.
- `email_verified` **não** é exigido, pois usuários criados pelo Console aparecem como "não verificados" e o login seria barrado.

#### O e-mail também vai no código

No `firebase.js` existe a constante `ALLOWED_EMAIL`. Troque pelo mesmo e-mail das regras:

```js
const ALLOWED_EMAIL = "seu-email@exemplo.com";
```

Ela recusa o login de outro e-mail e encerra sessões com e-mail diferente. Enquanto tiver o valor de exemplo (`SEU_EMAIL_ADMIN@exemplo.com`), a conferência é ignorada. Isso **não é segurança**, apenas controla a interface; a segurança real está nas regras. Resumo: o e-mail precisa estar **no Authentication** (usuário), **nas regras** (obrigatório) e **no código** (`ALLOWED_EMAIL`).

### 6. Regras de segurança (Firestore e Storage)
Use as regras de [`regras.md`](regras.md) (detalhadas no passo 5). Elas já restringem a gestão ao admin autenticado e mantêm, para o site de agendamento, apenas o acesso necessário (ler profissionais/serviços/horários e criar/remarcar/cancelar agendamentos).

## Como executar

Por usar ES Modules, abra por um servidor local (não por `file://`):

```bash
# opção 1
npx serve .
# opção 2
python -m http.server 5500
```

Ou use a extensão **Live Server** do VS Code e abra `index.html`. Para publicar, qualquer hospedagem estática serve (Vercel, Firebase Hosting, Netlify).

## Checklist de integração

- [ ] Firestore e Storage ativados no mesmo projeto Firebase
- [ ] `firebaseConfig` colado em `firebase.js` deste painel
- [ ] `firebaseConfig` **idêntico** no site de agendamento
- [ ] Authentication com **E-mail/senha** ativado e usuário administrador cadastrado
- [ ] E-mail do administrador colocado nas **regras** do Firestore e do Storage
- [ ] Profissionais e serviços cadastrados na aba de Configurações
- [ ] Teste: fazer um agendamento pelo site e conferir se aparece na Agenda deste painel
