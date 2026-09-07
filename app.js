const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_KEY = 'SUA_SB_PUBLISHABLE_KEY';
const DEVICE_ID = 'COLE_AQUI_UUID_DO_DEVICE_CX001';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function paint(s){
  const level=Number(s.level_percent||0);
  document.querySelector('#level').textContent=level+'%';
  document.querySelector('#bar').style.width=level+'%';
  document.querySelector('#float').textContent=s.master_float?'ATIVA':'INATIVA';
  document.querySelector('#flow').textContent=Number(s.flow_lpm||0).toFixed(2)+' L/min';
  document.querySelector('#pump1').textContent=s.pump1?'LIGADA':'DESLIGADA';
  document.querySelector('#pump2').textContent=s.pump2?'LIGADA':'DESLIGADA';
  document.querySelector('#online').textContent=s.online?'ONLINE':'OFFLINE';
}
async function load(){
  const {data,error}=await sb.from('device_status').select('*').eq('device_id',DEVICE_ID).single();
  if(error) return msg(error.message); if(data) paint(data);
}
async function command(command){
  const {error}=await sb.from('commands').insert({device_id:DEVICE_ID,command,status:'pending'});
  msg(error?'Erro: '+error.message:'Comando enviado: '+command);
}
function msg(t){document.querySelector('#msg').textContent=t}

sb.channel('tank-status')
 .on('postgres_changes',{event:'UPDATE',schema:'public',table:'device_status',filter:`device_id=eq.${DEVICE_ID}`},p=>paint(p.new))
 .subscribe();

load();
setInterval(load,10000);
