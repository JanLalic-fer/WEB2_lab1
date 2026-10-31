import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import oidc from 'express-openid-connect';
import jwtBearer from 'express-oauth2-jwt-bearer';
import QRCode from 'qrcode';
import {
  getStats, getPass, getAllPasses, createPass, cancelPass, deletePass,
} from './db.js';

dotenv.config();
const { auth, requiresAuth } = oidc;
const { auth: checkJwt, requiredScopes } = jwtBearer;

const app = express();
const port = process.env.PORT || 3000;
const baseURL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;

app.set('view engine', 'ejs');
app.set('views', path.join(import.meta.dirname, 'views'));
app.locals.formatDate = (d) =>
  new Date(d).toLocaleString('hr-HR', { timeZone: 'Europe/Zagreb' });

app.use(auth({
  authRequired: false,
  auth0Logout: true,
  secret: process.env.AUTH0_SECRET,
  baseURL,
  clientID: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  authorizationParams: { response_type: 'code' },
}));

const requireToken = checkJwt({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
  tokenSigningAlg: 'RS256',
});

app.get('/', async (req, res) => {
  const stats = await getStats();
  const user = req.oidc.isAuthenticated() ? req.oidc.user : null;
  const passes = user ? await getAllPasses() : [];
  res.render('index', { stats, user, passes });
});

app.get('/info/:id', async (req, res) => {
  const pass = await getPass(req.params.id);
  if (!pass) {
    return res.status(404).send('<h1>404 - Propusnica ne postoji</h1>');
  }
  res.render('info', { pass });
});

app.post('/admin/passes/:id/cancel', requiresAuth(), async (req, res) => {
  await cancelPass(req.params.id);
  res.redirect('/');
});

app.post('/admin/passes/:id/delete', requiresAuth(), async (req, res) => {
  await deletePass(req.params.id);
  res.redirect('/');
});

app.get('/passes/:id', requireToken, requiredScopes('read:passes'), async (req, res) => {
  const pass = await getPass(req.params.id);
  if (!pass) {
    return res.status(404).json({ error: 'Propusnica ne postoji' });
  }
  res.json(pass);
});

app.post('/passes', requireToken, requiredScopes('create:passes'), express.json(), async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const document = typeof req.body?.document === 'string' ? req.body.document.trim() : '';
  if (!name || !document) {
    return res.status(400).json({ error: 'Polja name i document su obavezna' });
  }

  const pass = await createPass(name, document);
  const qrPng = await QRCode.toBuffer(`${baseURL}/info/${pass.id}`, { type: 'png', width: 300 });

  res.status(201)
    .location(`${baseURL}/passes/${pass.id}`)
    .type('image/png')
    .send(qrPng);
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: err.message || 'Greška na serveru' });
});

app.listen(port, () => {
  console.log(`Server radi na ${baseURL}`);
});