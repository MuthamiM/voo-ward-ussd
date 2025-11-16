const https = require('https');
const API_KEY = process.env.RENDER_API_KEY;
const SERVICE = 'srv-d4bnodali9vc73bho5ug';
const DEP = 'dep-d4d0kq2dbo4c73di3h0g';
if (!API_KEY) { console.error('No API key'); process.exit(2); }
function req(path){return new Promise((resolve)=>{const opts={hostname:'api.render.com',path,method:'GET',headers:{Authorization:`Bearer ${API_KEY}`,Accept:'application/json'}};const r=https.request(opts,(r)=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>resolve({status:r.statusCode,body:d}));});r.on('error',e=>resolve({error:e.message}));r.end();});}
(async()=>{
  const endpoints = [
    `/v1/services/${SERVICE}/deploys/${DEP}/logs`,
    `/v1/services/${SERVICE}/deploys/${DEP}/events`,
    `/v1/services/${SERVICE}/logs`,
    `/v1/services/${SERVICE}/events`,
  ];
  for (const e of endpoints) {
    console.log('===', e);
    const r = await req(e);
    if (r.error) console.log('ERR', r.error);
    else {
      console.log('status:', r.status);
      console.log(r.body && r.body.slice(0,4000));
    }
  }
})();
