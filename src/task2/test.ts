import { getToken, issuePass } from './automat.ts';

const token = await getToken(
  `https://${process.env.AUTH0_DOMAIN}`,
  process.env.AUTH0_AUDIENCE!,
  process.env.M2M_CLIENT_ID!,
  process.env.M2M_CLIENT_SECRET!,
  'read:passes create:passes'
);
console.log('Token dobiven');

await issuePass('https://web2-lab1-jan.onrender.com/passes', token, 'Đurđa Marić', 'HR-238482374');
console.log('Propusnica izdana');