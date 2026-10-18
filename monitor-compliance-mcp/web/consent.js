import {createClient} from '@supabase/supabase-js';
const $=id=>document.getElementById(id);
const message=text=>{$('message').textContent=text;};
let supabase,transaction,details;
async function review(){
 const {data:{user},error}=await supabase.auth.getUser();
 if(error || !user)return;
 $('login').hidden=true; $('consent').hidden=false;
 $('client').textContent='Cliente solicitante: '+details.client_name;
 $('scopes').textContent='Permissão solicitada: consultar dados do Monitor Compliance.';
 $('approve').disabled=false; $('deny').disabled=false;
 message('Confira o cliente e autorize somente se você iniciou esta conexão no ChatGPT.');
}
$('login').addEventListener('submit',async e=>{
 e.preventDefault(); $('enter').disabled=true;
 try{
  const {error}=await supabase.auth.signInWithPassword({email:$('email').value,password:$('password').value});
  $('password').value='';
  if(error){message('Não foi possível entrar. Confira seu acesso ao projeto Supabase.');return;}
  await review();
 }catch{message('Não foi possível concluir o acesso. Reinicie pelo ChatGPT.');}
 finally{$('enter').disabled=false;}
});
for(const [id,decision]of [['approve','approve'],['deny','deny']]){
 $(id).addEventListener('click',async()=>{
  $('approve').disabled=true; $('deny').disabled=true;
  try{
   const {data:{session}}=await supabase.auth.getSession();
   const r=await fetch('/oauth/decision',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':details.csrf},body:JSON.stringify({transaction,decision,access_token:session?.access_token||''})});
   const data=await r.json();
   if(!r.ok || !data.redirect_url)throw new Error();
   const target=new URL(data.redirect_url);
   if(target.protocol!=='https:' || target.hostname!=='chatgpt.com')throw new Error();
   window.location.assign(target.href);
  }catch{message('Não foi possível finalizar. A conta pode não estar autorizada. Inicie novamente pelo ChatGPT.');}
 });
}
(async()=>{
 transaction=new URL(location.href).searchParams.get('transaction');
 if(!transaction || transaction.length>200){$('login').hidden=true;message('Abra esta tela a partir da conexão MCP no ChatGPT.');return;}
 const r=await fetch('/oauth/transaction?transaction='+encodeURIComponent(transaction),{cache:'no-store'});
 if(!r.ok){$('login').hidden=true;message('Solicitação expirada. Inicie novamente pelo ChatGPT.');return;}
 details=await r.json();
 const config=await(await fetch('/oauth/config',{cache:'no-store'})).json();
 supabase=createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
})().catch(()=>{message('Serviço de autorização indisponível.');$('login').hidden=true;});
