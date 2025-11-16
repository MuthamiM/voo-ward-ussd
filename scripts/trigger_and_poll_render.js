const https = require('https');

const API_KEY = process.env.RENDER_API_KEY;
const SERVICE_ID = 'srv-d4bnodali9vc73bho5ug';
if (!API_KEY) {
  console.error('No RENDER_API_KEY found in environment');
  process.exit(2);
}

function apiRequest(method, path, body) {
  const opts = {
    hostname: 'api.render.com',
    path,
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Accept': 'application/json'
    }
  };
  if (body) {
    const s = JSON.stringify(body);
    opts.headers['Content-Type'] = 'application/json';
    opts.headers['Content-Length'] = Buffer.byteLength(s);
  }
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({ statusCode: res.statusCode, body: json });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function createDeploy() {
  console.log('Triggering manual deploy for service', SERVICE_ID);
  try {
    const res = await apiRequest('POST', `/v1/services/${SERVICE_ID}/deploys`, {});
    console.log('Render API response:', res.statusCode);
    console.log(JSON.stringify(res.body, null, 2));
    return res.body && res.body.id;
  } catch (e) {
    console.error('Deploy request failed', e && e.message);
    return null;
  }
}

function fetchDebug() {
  return new Promise((resolve) => {
    https.get('https://voo-ward-ussd-1.onrender.com/__debug/admin-routes', (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          resolve({ ok: true, statusCode: res.statusCode, json: j });
        } catch (e) {
          resolve({ ok: false, statusCode: res.statusCode, text: d });
        }
      });
    }).on('error', (e) => resolve({ ok: false, error: e.message }));
  });
}

async function pollDebug(attempts = 20, interval = 15000) {
  for (let i = 1; i <= attempts; i++) {
    console.log(`Attempt ${i}/${attempts} - checking /__debug/admin-routes`);
    const r = await fetchDebug();
    console.log(JSON.stringify(r.json || r, null, 2));
    if (r.json && r.json.hasLogin) {
      console.log('Found hasLogin: true');
      return true;
    }
    if (i < attempts) {
      await new Promise(res => setTimeout(res, interval));
    }
  }
  console.log('Timed out waiting for hasLogin:true');
  return false;
}

async function listDeploys() {
  try {
    const res = await apiRequest('GET', `/v1/services/${SERVICE_ID}/deploys?limit=5`);
    console.log('Recent deploys (statusCode:', res.statusCode, ')');
    console.log(JSON.stringify(res.body, null, 2));
  } catch (e) {
    console.error('Failed to list deploys:', e && e.message);
  }
}

(async function main() {
  const deployId = await createDeploy();
  if (deployId) console.log('Triggered deploy id:', deployId);
  const ok = await pollDebug(20, 15000);
  await listDeploys();
  process.exit(ok ? 0 : 3);
})();
