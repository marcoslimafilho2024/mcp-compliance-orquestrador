# Deixar o Claude Code a usar este MCP (checklist)

Use esta lista na ordem. Assumimos **Claude Code** (CLI) no Windows; o ficheiro `claude_settings_example.json` mostra o **formato JSON** equivalente ao que o Claude grava em `.mcp.json` ou `~/.claude.json`.

---

## A. Servidor no Railway (uma vez por equipa)

1. **Ligar o repositório GitHub** ao projeto Railway e definir **Root** / **Dockerfile** conforme o teu deploy.
2. **Variáveis de ambiente** no Railway (Settings → Variables), **sem** commit no Git:
   - `MCP_SECRET` — palavra-passe longa e aleatória; **todas** as máquinas e o servidor usam o mesmo valor no header `Authorization`.
   - `LEGISWEB_USER`, `LEGISWEB_PASS` — login do site Legisweb.
   - `TAXPRATICO_USER`, `TAXPRATICO_PASS` — login do Tax Prático.
   - `PORT` — o Railway costuma injectar; se não, `3000` está alinhado com o código.
3. **Domínio público** do serviço (ex.: `https://xxx.up.railway.app`). Anota a URL base.
4. **Smoke test** no browser ou terminal:
   - `GET https://<teu-dominio>/health` → JSON com `"status":"ok"` e `timestamp`.
   - Se falhar, o deploy ou o healthcheck ainda não estão corretos — não avances para o Claude.

---

## B. Código Playwright (antes de confiar nas tools)

Os agentes ainda usam **`PLACEHOLDER_SELECTOR`** nos formulários e listagens. Até substituíres por seletores reais (após inspecionar o HTML dos dois sites), as tools **podem ligar ao MCP** mas **vão falhar** ou devolver vazio ao chamar Legisweb / Tax Prático.

---

## C. Cada máquina com Claude Code

### Opção 1 — CLI (recomendado)

Na pasta do projeto onde queres o servidor (ou com `--scope user` para todos os projetos):

```bash
claude mcp add --transport sse --header "Authorization: Bearer <COLA_O_MCP_SECRET_AQUI>" mcp-compliance https://<teu-dominio-railway>/sse
```

- **Scope project** (ficheiro `.mcp.json` na raiz do repo, partilhável):  
  `claude mcp add --transport sse --scope project --header "Authorization: Bearer ..." mcp-compliance https://.../sse`
- **Scope user** (todas as pastas, em `~/.claude.json`):  
  acrescenta `--scope user`.

Reinicia ou abre de novo o Claude Code. Dentro do chat, **`/mcp`** deve mostrar `mcp-compliance` ligado e as tools (`buscar_legisweb`, etc.).

### Opção 2 — JSON manual

- **Projecto:** raiz do repo → ficheiro **`.mcp.json`** com o bloco `mcpServers` (podes copiar de `claude_settings_example.json` e renomear ajustando URL e token).
- **Utilizador:** configuração em **`%USERPROFILE%\.claude.json`** (Linux/mac: `~/.claude.json`), secção `mcpServers` conforme a [documentação](https://docs.anthropic.com/en/docs/claude-code/mcp/).

Para **não** commitar o segredo no Git, em `.mcp.json` podes usar expansão de variável de ambiente, por exemplo:

`"Authorization": "Bearer ${MCP_COMPLIANCE_SECRET}"`

e definir `MCP_COMPLIANCE_SECRET` no Windows (variáveis de utilizador ou `setx`).

### Copiar para o Google Drive (3 PCs)

Copia para a pasta partilhada, por exemplo:

`G:\Meu Drive\000_PROJETO CLAUDE\`

os ficheiros `claude_settings_example.json` e este `onboarding.md`, para todos seguirem a mesma URL e o mesmo procedimento (cada um ainda precisa do **header** com o `MCP_SECRET` ou da env var se usares `${...}`).

---

## D. Validar que o Claude “vê” o MCP

1. **`/mcp`** — servidor listado, sem erro de ligação.
2. **`claude mcp list`** (terminal) — entrada `mcp-compliance` com a URL certa.
3. Pedido de teste ao modelo: “Lista as tools do servidor mcp-compliance” ou invoca `buscar_legisweb` com um termo curto (só fará sentido depois dos seletores reais).

---

## E. Erros frequentes

| Sintoma | Causa provável |
|--------|----------------|
| 401 no `/sse` | Token no cliente ≠ `MCP_SECRET` no Railway (espaço a mais, `Bearer` duplicado). |
| `/health` OK mas MCP falha | URL errada (falta `/sse`), firewall, ou domínio Railway a dormir no plano free. |
| MCP conecta, tools rebentam | `PLACEHOLDER_SELECTOR` ainda não mapeado; credenciais dos sites erradas ou site com 2FA/captcha. |

Quando A + C + D estiverem verdes e B resolvido, o Claude Code fica **no ponto** para usar este MCP em rotina.
