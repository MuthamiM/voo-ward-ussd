const https = require('https');
const API_KEY = process.env.RENDER_API_KEY;
const SERVICE = 'srv-d4bnodali9vc73bho5ug';
if (!API_KEY) { console.error('No API key'); process.exit(2); }
function req(path){return new Promise((res,rej)=>{const opts={hostname:'api.render.com',path,method:'GET',headers:{Authorization:`Bearer ${API_KEY}`,Accept:'application/json'}};const r=https.request(opts,(r)=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{res(JSON.parse(d))}catch(e){res(d)}});});r.on('error',rej);r.end();});}
(async()=>{try{const s=await req(`/v1/services/${SERVICE}`); if (s && s.service) { console.log('name:', s.service.name); console.log('type:', s.service.type); console.log('liveUrl:', s.service.liveUrl); console.log('status:', s.service.status); console.log('region:', s.service.region); } else { console.log(JSON.stringify(s,null,2)); } }catch(e){console.error('err',e.message)} })();
