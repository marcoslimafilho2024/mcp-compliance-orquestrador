# Monitor Compliance MCP 0.3.0

Serviço de consultas ao WorkMonitor, hospedado no Railway e autenticado com uma conta existente do Supabase. O módulo é independente do orquestrador na raiz do repositório.

## Ferramentas

| Ferramenta | Resultado |
| --- | --- |
| status_integracao | Configuração do servidor, sem expor segredos |
| listar_colaboradores | Identificação das pessoas no escopo selecionado |
| consultar_produtividade | Horas, atividade, ócio e departamentos em um intervalo |
| comparar_periodos | Duas bases com os mesmos critérios e escopo |

## Autenticação

O próprio MCP implementa o servidor OAuth 2.1 usando o SDK oficial `mcp` 1.30.0: descoberta, cadastro dinâmico de clientes públicos, authorization code com PKCE S256, renovação e revogação.

O usuário entra na tela de consentimento usando seu acesso existente ao projeto Supabase. O SDK Supabase no frontend envia a senha diretamente ao Supabase e mantém a sessão apenas na memória da página. O backend verifica assinatura ES256, emissor, audiência e usuário autorizado, além de validar o acesso em `/auth/v1/user`, antes de aceitar a decisão explícita de consentimento.

O MCP emite seus próprios tokens opacos, destinados exclusivamente ao recurso configurado em `MCP_RESOURCE_URL` e ao escopo `monitor:read`. Não aceita um JWT comum do Supabase como token MCP. Os códigos são de uso único, e os refresh tokens são rotacionados. Revogar um token invalida a respectiva família. Senhas e tokens Supabase não são persistidos pelo servidor. Tokens MCP e códigos são guardados somente como hashes no SQLite do volume privado.

Essa integração não exige habilitar o OAuth Server nativo nem mudar Site URL, Authorization Path ou clientes de outras aplicações do projeto compartilhado no Supabase. Os modos anteriores de verificação externa permanecem no código para compatibilidade; a implantação usa `OAUTH_MODE=supabase-login`.

Cadastro dinâmico aceita somente callbacks HTTPS em `chatgpt.com`. A tela exige decisão explícita, valida origem e CSRF e aceita somente o usuário listado em `OAUTH_ALLOWED_SUBJECTS`. Não há acesso anônimo aos dados WorkMonitor.

Tokens de acesso duram 1 hora e refresh tokens 7 dias. Remover um usuário da lista autorizada impede novos acessos. As sessões OAuth do MCP são independentes da sessão do painel administrativo Supabase; para encerrar o acesso do MCP, usar a revogação do MCP.

Compatibilidade: o SDK MCP 1.30.0 declara `client_secret` opcional, mas sem default no formulário de revogação. A inicialização corrige esse default para `None`, preservando o autenticador do SDK. O teste cobre revogação de cliente público sem segredo.

## Railway

Usar este diretório como Root Directory, com o Dockerfile incluído. O build empacota o frontend Supabase localmente e instala Chromium. O processo de aplicação executa sem root; o entrypoint prepara a propriedade do volume antes de descartar privilégios.

Montar um volume persistente em `/data`, em uma única instância. O banco OAuth não deve ser armazenado apenas no filesystem efêmero. O volume contém registros privados de autenticação; não deve ser exposto, incluído no Git ou servido pela aplicação.

Preencher as variáveis de `.env.example` no gerenciador de variáveis do Railway. A chave Supabase utilizada é publicável. A senha WorkMonitor deve existir somente nas variáveis protegidas do serviço. Nenhum segredo de produção está incluído no código.

Endpoints:

| Caminho | Uso |
| --- | --- |
| /health | Disponibilidade do processo |
| /mcp | MCP Streamable HTTP autenticado |
| /.well-known/oauth-authorization-server | Descoberta OAuth |
| /.well-known/oauth-protected-resource/mcp | Metadados do recurso |
| /oauth/consent | Login e autorização iniciados pelo fluxo OAuth |

No ChatGPT, adicionar um servidor MCP personalizado com a URL HTTPS real terminada em `/mcp`, autenticação OAuth e cadastro dinâmico. O cliente precisa enviar `token_endpoint_auth_method=none` e PKCE S256. As opções disponíveis dependem da configuração da conta ChatGPT. A conexão só termina após o usuário entrar e consentir na tela.

## Validação

20 testes aprovados na versão 0.3.0: protocolo MCP via HTTP e stdio, rejeição de tokens, filtros e escopo, datas, fluxo OAuth completo com PKCE, rejeição de origem/CSRF, uso único, renovação, revogação e persistência após reinicialização. O frontend também compila com dependências fixadas e lockfile.

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt pytest==9.1.1
npm ci --ignore-scripts --prefix web
npm run build --prefix web
.venv/bin/python -m pytest -q
```

Os testes usam identidades e dados fictícios; não comprovam uma conexão ChatGPT real nem uma coleta WorkMonitor completa em produção. Esses dois testes de aceitação precisam ser feitos após a autorização real do usuário.

## Consulta ao portal

O adaptador usa a interface autenticada em `web.workmonitor.com`, sem inventar endpoints de uma API privada. Os seletores e as 13 colunas do ranking foram inspecionados na interface em 17/10/2026. Alterar datas exige clicar Buscar antes de ler os resultados.

O escopo é o selecionado na conta; não presumir que representa toda a empresa. O filtro de nome opera no ranking; indicadores de departamento continuam sendo do escopo completo. Valores e tempos auxiliares são preservados. Falhas de login, estrutura, cobertura ou carregamento interrompem a consulta. Não contornar desafios de segurança.

Atividade, performance e score Gen.IA têm significados distintos. Ausência de captura não prova falta ou baixo desempenho. O serviço não altera jornada, cadastro ou classificação, não envia mensagens e não oferece capturas ao vivo.

## Fontes

- https://github.com/modelcontextprotocol/python-sdk
- https://developers.openai.com/plugins/build/auth
- https://supabase.com/docs/guides/auth
- https://playwright.dev/python/docs/auth
