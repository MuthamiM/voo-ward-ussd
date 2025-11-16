const https = require('https');
const API_KEY = process.env.RENDER_API_KEY;
const SERVICE = 'srv-d4bnodali9vc73bho5ug';
const DEP = 'dep-d4d0kq2dbo4c73di3h0g';
if (!API_KEY) { console.error('No RENDER_API_KEY'); process.exit(2); }

function req(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.render.com',
      path,
      method: 'GET',
      headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' }
    };
    const r = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { resolve(d); }
      });
    });
    r.on('error', reject);
    r.end();
  });
}

(async () => {
  try {
    console.log('Fetching events for', DEP);
    const ev = await req(`/v1/services/${SERVICE}/deploys/${DEP}/events`);
    console.log(JSON.stringify(ev, null, 2));
  } catch (e) {
    console.error('Error fetching events:', e && e.message);
  }
})();
