import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import oidc from 'express-openid-connect';
import { getStats, getPass, getAllPasses, cancelPass, deletePass } from './db.js';

dotenv.config();
const { auth, requiresAuth } = oidc;

const app = express();
const port = process.env.PORT || 3000;
// Na Renderu postoji RENDER_EXTERNAL_URL, lokalno koristimo localhost
const baseURL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;

app.set('view engine', 'ejs');
app.set('views', path.join(import.meta.dirname, 'views'));
app.locals.formatDate = (d) =>
  new Date(d).toLocaleString('hr-HR', { timeZone: 'Europe/Zagreb' });

// OIDC prijava preko Auth0 (automatski dodaje rute /login, /logout i /callback)
app.use(auth({
  authRequired: false, // stranice su javne, osim onih s requiresAuth()
  auth0Logout: true,
  secret: process.env.AUTH0_SECRET,
  baseURL,
  clientID: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  authorizationParams: { response_type: 'code' },
}));

// ---------- Javne stranice ----------

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

// ---------- Upravljanje (samo za prijavljene) ----------

app.post('/admin/passes/:id/cancel', requiresAuth(), async (req, res) => {
  await cancelPass(req.params.id);
  res.redirect('/');
});

app.post('/admin/passes/:id/delete', requiresAuth(), async (req, res) => {
  await deletePass(req.params.id);
  res.redirect('/');
});

app.listen(port, () => {
  console.log(`Server radi na ${baseURL}`);
});