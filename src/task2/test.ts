import { getToken, issuePass } from './automat.ts';
//https://jan-web2.eu.auth0.com/.well-known/openid-configuration
const token = await getToken(
  `https://${process.env.AUTH0_DOMAIN}`,
  process.env.AUTH0_AUDIENCE!,
  process.env.M2M_CLIENT_ID!,
  process.env.M2M_CLIENT_SECRET!,
  'read:passes create:passes'
);
const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
console.log('Scope u tokenu:', payload.scope);
console.log('Token dobiven');

await issuePass('https://web2-lab1-jan.onrender.com/passes', token, 'Đurđa Marić', 'HR-238482374');
console.log('Propusnica izdana');