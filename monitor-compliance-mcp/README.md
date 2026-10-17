# Monitor Compliance MCP — 0.2.0

Servidor MCP de consulta para o WorkMonitor da Compliance, com quatro ferramentas:

| Ferramenta | Função |
| --- | --- |
| `status_integracao` | Estado de configuração, sem expor credenciais ou testar login |
| `listar_colaboradores` | Lista de pessoas no escopo selecionado da conta |
| `consultar_produtividade` | Ranking, horas, ócio e departamentos por período |
| `comparar_periodos` | Duas consultas com as bases preservadas |

## Estado da entrega

Código criado e protocolo MCP testado, com 18 testes aprovados em 17/10/2026. A versão HTTP exige autenticação OAuth e não publica os dados anonimamente.

O portal foi acessado nesta conversa pelo navegador, e os campos de datas, o botão Buscar e as 13 colunas reais do ranking foram conferidos. O adaptador usa essa interface, sem presumir endpoints de uma API privada.

**Ainda não publicado nem conectado ao ChatGPT.** O login e a coleta completos pelo adaptador Playwright em um servidor externo ainda precisam de validação. Os testes de protocolo usam dados fictícios e não comprovam acesso em produção. A imagem Docker e a emissão de HTTPS também precisam ser verificadas no ambiente escolhido.

## Publicação para ChatGPT

Requer um servidor Linux com Docker Compose, um subdomínio sob controle da Compliance e um provedor OAuth compatível (por exemplo, o provedor corporativo, desde que suporte os requisitos abaixo). Nenhum serviço pago ou conta externa foi criado nesta entrega.

1. Apontar o DNS do subdomínio para o servidor. Liberar 80/443 para o proxy HTTPS. Não expor a porta 8000 diretamente à Internet.
2. Copiar `.env.example` para `.env` **somente no servidor**, com permissão restrita. Preencher os endereços reais e as credenciais pelo gerenciador de segredos. A senha fornecida no chat não está incluída no projeto.
3. Configurar o provedor OAuth para authorization code com PKCE S256 e registrar o cliente ChatGPT por CIMD, DCR ou cliente previamente registrado, conforme suporte do provedor. A URL exata de callback deve vir da tela de configuração da conexão no ChatGPT; não inventá-la.
4. Registrar o recurso/audiência igual a `MCP_RESOURCE_URL`, por exemplo o endereço HTTPS real terminado em `/mcp`. Criar o escopo `monitor:read`. O token JWT deve conter `iss`, `aud`, `exp`, `sub` e `scope`, assinado com RS256. O provedor precisa preservar o parâmetro OAuth `resource` e emiti-lo como audiência.
5. Preencher `OAUTH_ALLOWED_SUBJECTS` com o `sub` do Marcos, obtido do provedor. Isso é obrigatório: não basta ter uma conta válida no provedor para acessar a conta compartilhada do WorkMonitor.
6. Executar `docker compose up --build -d`. O Caddy obtém HTTPS automaticamente quando DNS e portas estiverem corretos. O serviço se recusa a iniciar sem a configuração OAuth necessária.
7. Verificar `/health`, o desafio 401 em `/mcp` sem token e os metadados em `/.well-known/oauth-protected-resource/mcp`.
8. Testar o fluxo OAuth com o provedor real e uma consulta de um único dia. Conferir os resultados diretamente no portal, inclusive escopo selecionado, datas e ranking completo.
9. Adicionar o servidor MCP no ChatGPT usando a URL HTTPS real de `/mcp` e concluir o vínculo OAuth. A disponibilização da opção depende da conta e das configurações do ChatGPT.

A autenticação OAuth protege o acesso do ChatGPT ao MCP. As credenciais WorkMonitor são usadas separadamente pelo servidor para consultar a conta da Compliance; não são usadas para o login OAuth.

## Executar os testes

Python 3.12:

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt pytest==9.1.1
.venv/bin/python -m pytest -q
```

Os testes não abrem um navegador nem usam credenciais reais. Cobrem validação de períodos, extração de colunas, filtros, comparação, negociação MCP por stdio e HTTP, descoberta OAuth e rejeição de tokens com emissor, audiência, expiração, usuário ou escopo incorretos.

Para uso local, `python server.py --stdio` oferece o transporte stdio sem OAuth. Este modo não cria um endpoint HTTP. Consultas reais ainda requerem as credenciais no ambiente e Chromium instalado (`python -m playwright install --with-deps chromium`).

## Limites operacionais

O adaptador lança um navegador isolado por consulta e não grava cookies, vídeos, telas ou senhas em disco. Consultas simultâneas são serializadas por processo. Manter uma instância/worker inicialmente. No ambiente real, dimensionar memória e limitar requisições no proxy conforme a carga.

O escopo consultado é o selecionado pela conta WorkMonitor; não há garantia automática de que corresponda a toda a empresa. O filtro opcional por colaborador é aplicado ao ranking retornado; os indicadores de departamento continuam sendo do escopo completo e isso é informado no resultado.

A interface pode mudar. Mudanças de colunas, autenticação, desafios de segurança, falta de cobertura ou carregamento incompleto causam erro e exigem revisão. Não contornar CAPTCHAs. Se o servidor não conseguir consultar o portal, preferir obter a documentação e a autorização da API oficial junto ao fornecedor. O projeto não usa `workmonitor.ai`: não foi validado que esse domínio pertença ao mesmo produto da conta informada.

Atividade, performance e score Gen.IA não são intercambiáveis. Tempos auxiliares e rótulos são preservados. Ausência de captura não prova falta ou desempenho inadequado. Não existem ferramentas de alteração, aprovação de ponto, captura ao vivo ou envio de mensagens.

## Referências

- [SDK oficial MCP para Python](https://github.com/modelcontextprotocol/python-sdk)
- [Autenticação de servidores MCP para ChatGPT](https://developers.openai.com/plugins/build/auth)
- [Autenticação do Playwright](https://playwright.dev/python/docs/auth)


## Railway + projeto Supabase existente

Esta versão inclui uma tela de consentimento em `/oauth/consent` com o SDK Supabase empacotado localmente. Não depende de scripts CDN na página de login. O frontend usa apenas a chave publicável; as credenciais WorkMonitor ficam nas variáveis protegidas do Railway. Não são incluídas no repositório.

Para o modo Supabase, configurar `OAUTH_MODE=supabase`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, emissor e JWKS do projeto, `OAUTH_ALLOWED_SUBJECTS` e `OAUTH_ALLOWED_CLIENT_IDS`. A assinatura é ES256, conforme a chave do projeto selecionado.

**A configuração genérica descrita acima se aplica ao modo OAuth estrito. No modo Supabase, não configurar o escopo monitor:read no provedor:** os escopos nativos anunciados são openid/email. O acesso às consultas é uma permissão interna do MCP, concedida somente quando usuário e cliente OAuth constam das listas administrativas. Sessões normais do Supabase e tokens de outros clientes são rejeitados. Sem cliente configurado, o MCP recusa todas as chamadas.

Limitação documentada do provedor: Supabase não implementa indicadores de recurso RFC 8707; sua audiência é authenticated, compartilhada no projeto. A verificação adicional obrigatória de um cliente OAuth dedicado impede aceitar tokens de outros aplicativos. Isso não equivale a suporte nativo a audiência por recurso. Para exigências estritas de RFC 8707, usar o modo genérico com um provedor que emita a audiência do MCP.

A UI de consentimento depende da configuração OAuth do Supabase. Antes de alterar Site URL ou Authorization Path de um projeto compartilhado, verificar as aplicações existentes. Não substituir configurações globais sem avaliar impacto. Preferir hospedar ou encaminhar a rota de consentimento no Site URL já utilizado pelo projeto. O conector Supabase atual não configura essas propriedades administrativas de Auth.

Registrar um cliente OAuth exclusivo para este MCP, com a URL de callback exata fornecida pelo ChatGPT, e informar seu client_id em OAUTH_ALLOWED_CLIENT_IDS no Railway. O usuário deverá autenticar e consentir na interface. Nenhuma aprovação é automática.

Referências: https://gofastmcp.com/integrations/supabase e https://supabase.com/docs/guides/auth/oauth-server/getting-started .
