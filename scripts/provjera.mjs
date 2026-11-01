const BASE = process.env.TEST_BASE_URL || 'https://web2-lab1-jan.onrender.com';
const AUTHORITY = `https://${process.env.AUTH0_DOMAIN}`;
const AUDIENCE = process.env.AUTH0_AUDIENCE;
const NIL = '00000000-0000-0000-0000-000000000000';

let passed = 0;
let failed = 0;

async function getToken(clientId, clientSecret) {
  const res = await fetch(`${AUTHORITY}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      audience: AUDIENCE,
    }),
  });
  if (!res.ok) throw new Error(`Token nije dobiven: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

const authHeader = (t) => (t ? { Authorization: `Bearer ${t}` } : {});

const get = (path, token) =>
  fetch(BASE + path, { headers: authHeader(token), redirect: 'manual' });

const post = (path, body, token, raw) =>
  fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: raw ?? JSON.stringify(body),
    redirect: 'manual',
  });

async function check(name, expected, doRequest, extraCheck) {
  try {
    const res = await doRequest();
    let ok = res.status === expected;
    let note = '';
    if (ok && extraCheck) {
      const result = await extraCheck(res);
      if (result !== true) {
        ok = false;
        note = `(${result})`;
      }
    }
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: očekivano ${expected}, dobiveno ${res.status} ${note}`);
    ok ? passed++ : failed++;
  } catch (err) {
    console.log(`FAIL  ${name}: ${err.message}`);
    failed++;
  }
}

console.log(`Testiram ${BASE} (prvi zahtjev može trajati do minute dok se Render probudi)\n`);

const T = await getToken(process.env.M2M_CLIENT_ID, process.env.M2M_CLIENT_SECRET);
const RO = process.env.RO_CLIENT_ID
  ? await getToken(process.env.RO_CLIENT_ID, process.env.RO_CLIENT_SECRET)
  : null;

let id;
await check('P7  POST uspjeh (201, PNG, Location)', 201,
  () => post('/passes', { name: 'Test Provjera', document: 'HR-TEST-1' }, T),
  async (res) => {
    const type = res.headers.get('content-type') || '';
    const location = res.headers.get('location') || '';
    if (!type.startsWith('image/png')) return `Content-Type je ${type}`;
    if (!location.startsWith(`${BASE}/passes/`)) return `Location je ${location}`;
    id = location.split('/').pop();
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.subarray(0, 4).toString('hex') !== '89504e47') return 'tijelo nije PNG';
    return true;
  });

if (!id) {
  console.log('\nNije izdana testna propusnica, ostale provjere se preskaču.');
  process.exit(1);
}

await check('G1  GET bez tokena', 401, () => get(`/passes/${id}`));
await check('G2  GET neispravan token', 401, () => get(`/passes/${id}`, 'abc'));
await check('G3  GET ispravan token', 200, () => get(`/passes/${id}`, T), async (res) => {
  const p = await res.json();
  const keys = Object.keys(p).sort().join(',');
  if (keys !== 'document,id,issuedAt,name,status') return `svojstva su ${keys}`;
  if (p.id !== id || p.name !== 'Test Provjera' || p.status !== 'ACTIVE') return 'krivi podaci';
  return true;
});
await check('G4  GET nepostojeća propusnica', 404, () => get(`/passes/${NIL}`, T));
await check('G5  GET besmislen ID', 404, () => get('/passes/abc', T));

await check('P1  POST bez tokena', 401, () => post('/passes', { name: 'A', document: 'B' }));
await check('P3  POST prazno ime', 400, () => post('/passes', { name: '', document: 'B' }, T));
await check('P4  POST bez document', 400, () => post('/passes', { name: 'A' }, T));
await check('P5  POST samo razmaci', 400, () => post('/passes', { name: '   ', document: 'B' }, T));
await check('P6  POST neispravan JSON', 400, () => post('/passes', null, T, '{neispravno'));

if (RO) {
  await check('G6  GET read-only token', 200, () => get(`/passes/${id}`, RO));
  await check('P2  POST read-only token', 403, () => post('/passes', { name: 'A', document: 'B' }, RO));
} else {
  console.log('SKIP  G6 i P2 (403): nema RO_CLIENT_ID u .env');
}

await check('W3  info postojeća', 200, () => get(`/info/${id}`));
await check('W4  info nepostojeća', 404, () => get(`/info/${NIL}`));
await check('W5  info besmislen ID', 404, () => get('/info/abc'));
await check('W6  poništavanje bez prijave', 302, () => post(`/admin/passes/${id}/cancel`, {}));
await check('W6b propusnica i dalje ACTIVE', 200, () => get(`/passes/${id}`, T), async (res) => {
  const p = await res.json();
  return p.status === 'ACTIVE' ? true : `status je ${p.status}`;
});

console.log(`\nUkupno: ${passed} PASS, ${failed} FAIL`);