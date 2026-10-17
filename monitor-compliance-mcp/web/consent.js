import {createClient} from '@supabase/supabase-js';
const $ = id => document.getElementById(id);
const message = text => { $('message').textContent = text; };
let supabase, authorizationId, approvedRedirect;
async function review() {
  const {data:{user},error} = await supabase.auth.getUser();
  if (error || !user) return;
  const config = await (await fetch('/oauth/config',{cache:'no-store'})).json();
  if (user.id !== config.allowedUserId) {
    await supabase.auth.signOut();
    message('Esta conta não está autorizada a consultar o Monitor Compliance.'); return;
  }
  const {data,error:detailError} = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (detailError || !data) { message('Não foi possível carregar a solicitação. Inicie a conexão novamente pelo ChatGPT.'); return; }
  $('login').hidden=true; $('consent').hidden=false;
  $('client').textContent='Cliente solicitante: '+(data.client?.name || 'Cliente OAuth');
  $('scopes').textContent='Escopos de identidade solicitados: '+(data.scope || 'não informado');
  // Uma autorização prévia pode retornar somente redirect_url. Não redirecionar
  // automaticamente: a decisão permanece explícita nesta tela.
  if (data.redirect_url) { approvedRedirect=data.redirect_url; $('approve').textContent='Continuar no ChatGPT'; $('approve').disabled=false; message('Autorização já registrada. Continue para voltar ao ChatGPT.'); return; }
  $('approve').disabled=false; $('deny').disabled=false;
}
$('login').addEventListener('submit',async e=>{
  e.preventDefault(); $('enter').disabled=true;
  try {
    const {error}=await supabase.auth.signInWithPassword({email:$('email').value,password:$('password').value});
    $('password').value='';
    if(error) { message('Não foi possível entrar. Confira seu acesso ao projeto Supabase.'); return; }
    await review();
  } catch {message('Não foi possível concluir o acesso. Tente novamente pelo ChatGPT.');}
  finally {$('enter').disabled=false;}
});
for(const [id,method] of [['approve','approveAuthorization'],['deny','denyAuthorization']]) {
  $(id).addEventListener('click',async()=>{
    $('approve').disabled=true; $('deny').disabled=true;
    try {
      if(id==='approve' && approvedRedirect) { const target=new URL(approvedRedirect); if(target.protocol!=='https:' || target.hostname!=='chatgpt.com') throw new Error(); window.location.assign(target.href); return; }
      const {data,error}=await supabase.auth.oauth[method](authorizationId,{skipBrowserRedirect:true});
      if(error || !data?.redirect_url) throw new Error();
      const target=new URL(data.redirect_url);
      if(target.protocol!=='https:' || target.hostname!=='chatgpt.com') throw new Error();
      window.location.assign(target.href);
    } catch {message('Não foi possível finalizar. Inicie a conexão novamente pelo ChatGPT.');}
  });
}
(async()=>{
  authorizationId=new URL(location.href).searchParams.get('authorization_id');
  if(!authorizationId || authorizationId.length>200) {$('login').hidden=true; message('Abra esta tela a partir da conexão MCP no ChatGPT.');return;}
  const config=await (await fetch('/oauth/config',{cache:'no-store'})).json();
  supabase=createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  await review();
})().catch(()=>{message('Serviço de autorização indisponível.');$('login').hidden=true;});
