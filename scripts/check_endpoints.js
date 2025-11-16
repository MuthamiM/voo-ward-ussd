const https = require('https');
const URL_HOST = 'voo-ward-ussd-1.onrender.com';
const paths = ['/health','/admin-dashboard.html','/__debug/admin-routes','/api/auth/login','/api/admin/stats'];

function get(p) {
  return new Promise((resolve) => {
    https.get({hostname: URL_HOST, path: p, method: 'GET', timeout: 10000}, (res) => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({path:p, status: res.statusCode, body: d.slice(0,8000)}));
    }).on('error', (e) => resolve({path:p, error: e.message}));
  });
}

(async ()=>{
  for (const p of paths) {
    console.log('---',p);
    const r = await get(p);
    console.log(JSON.stringify(r, null, 2));
  }
})();
