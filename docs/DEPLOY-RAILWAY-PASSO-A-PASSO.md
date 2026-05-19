# Deploy no Railway (passo a passo, devagar)

Objetivo: ter o MCP no ar com URL pública e `/health` a responder.  
Pasta do projeto: `C:\Projetos Tecnologicos\04_MCP_Servidores_Operacional`

---

## Fase A — Git no teu PC (só uma vez nesta pasta)

### A1. Abrir terminal nesta pasta

PowerShell:

```powershell
cd "C:\Projetos Tecnologicos\04_MCP_Servidores_Operacional"
```

### A2. Inicializar repositório (se ainda não existir `.git`)

```powershell
git init
```

### A3. Primeiro commit (obrigatório para enviar código ao GitHub)

```powershell
git add .
git status
git commit -m "chore: MCP orquestrador com SSE e agentes Legisweb/Tax Prático"
```

Se o `git` pedir nome e email na primeira vez:

```powershell
git config user.email "teu@email.com"
git config user.name "Teu Nome"
```

(Repete o `git commit` depois disto.)

---

## Fase B — Repositório no GitHub

### B1. Criar repo vazio no GitHub

1. Entra em https://github.com/new  
2. Nome do repositório: por exemplo `mcp-compliance-orquestrador`  
3. **Público** ou **Privado** (Railway aceita os dois com a conta certa)  
4. **Não** marques “Add a README” (já tens código local)  
5. Cria o repositório.

### B2. Ligar o remoto e enviar (substitui `TEU_USER` e `TEU_REPO`)

```powershell
git remote add origin https://github.com/TEU_USER/TEU_REPO.git
git branch -M main
git push -u origin main
```

Se pedir login, usa o método que o GitHub indicar (browser, token PAT, etc.).

---

## Fase C — Railway ligado ao GitHub

### C1. Conta Railway

1. https://railway.app — regista ou entra (podes usar “Login with GitHub”).

### C2. Novo projeto a partir do repo

1. **New Project**  
2. **Deploy from GitHub repo** (ou equivalente)  
3. Autoriza o Railway a aceder aos teus repositórios GitHub, se pedir.  
4. Escolhe o repositório que acabaste de criar (`TEU_REPO`).

### C3. Garantir que o build usa Docker (recomendado por causa do Playwright)

1. Abre o **serviço** que o Railway criou.  
2. **Settings** (ou **Variables** / painel do serviço) → procura **Build** / **Docker**.  
3. Define o **Root Directory** vazio (raiz) se só tens um serviço.  
4. Confirma que o Railway usa **Dockerfile** na raiz do repo (não só Nixpacks Node “à la carte”, que pode falhar no Playwright).

Se o Railway não detectar Dockerfile: nas definições do serviço, escolhe explicitamente **Docker** como método de build.

### C4. Primeiro deploy

1. Guarda as definições; o Railway faz **build** e **deploy**.  
2. Abre o separador **Deployments** / **Logs** e espera até aparecer “success” ou o servidor a arrancar.  
3. O primeiro build pode demorar vários minutos (`playwright install chromium`).

---

## Fase D — Variáveis de ambiente (segredos)

No serviço no Railway: **Variables** → **Raw Editor** ou adiciona uma a uma:

| Nome | O quê pôr |
|------|-----------|
| `MCP_SECRET` | Uma string longa e aleatória (ex.: 32+ caracteres). **Anota** — vais precisar no Claude Code. |
| `LEGISWEB_USER` | Utilizador do Legisweb |
| `LEGISWEB_PASS` | Palavra-passe do Legisweb |
| `TAXPRATICO_USER` | Utilizador do Tax Prático |
| `TAXPRATICO_PASS` | Palavra-passe do Tax Prático |

**`PORT`:** no Railway costuma ser definida **automaticamente**. Se vires erro de porta, adiciona `PORT` com o valor que o Railway mostrar (muitas vezes não precisas de mexer).

Guarda. O Railway **redeploya** sozinho após alterar variáveis.

---

## Fase E — Domínio público

1. No serviço: **Settings** → **Networking** / **Generate Domain** (ou “Public URL”).  
2. Gera um domínio (ex.: `something-production.up.railway.app`).  
3. A URL base fica algo como: `https://something-production.up.railway.app`

Anota:

- Health: `https://<domínio>/health`  
- SSE (para depois no Claude): `https://<domínio>/sse`

---

## Fase F — Testar se está no ar

### F1. Health (sem token)

No browser abre:

`https://<TEU_DOMINIO>/health`

Deves ver JSON parecido com:

```json
{"status":"ok","timestamp":"..."}
```

### F2. Se não abrir

- Vê **Logs** no Railway (erro de build, crash ao iniciar, porta).  
- Confirma que o **comando de start** é `node dist/index.js` (o `railway.toml` já indica isso; com Docker o **CMD** do Dockerfile também está certo).

---

## Nota sobre `railway.toml` e Docker

- Com **Dockerfile**, o **build** acontece **dentro** da imagem (`npm install`, `playwright install chromium`, `npm run build`).  
- O bloco `[build] command = "npm run build"` no `railway.toml` aplica-se sobretudo quando o Railway usa **Nixpacks** em vez de Docker.  
- Se usares **só Docker**, o mais importante é o **Dockerfile** estar correto; o `healthcheckPath` no `railway.toml` continua útil ao Railway.

---

## Depois disto (Fase G — não é Railway, é o Claude)

Quando o `/health` estiver OK:

1. No Claude Code (noutro guia ou no `onboarding.md`):  
   `claude mcp add --transport sse --header "Authorization: Bearer <MCP_SECRET>" mcp-compliance https://<domínio>/sse`  
2. Dentro do Claude: **`/mcp`** para ver se ligou.

---

## Onde estás agora?

- **Ainda sem Git:** faz Fase A e B.  
- **Já tens código no GitHub:** faz C → D → E → F.  
- **`/health` OK:** passa à Fase G (Claude).

Quando concluíres uma fase, diz qual (ex.: “terminei B”) e seguimos ao pormenor do próximo bloqueio, se aparecer algum erro nos logs.
