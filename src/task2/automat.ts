import { writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';

export async function getToken(
  authority: string,
  audience: string,
  clientId: string,
  clientSecret: string,
  scope: string
): Promise<string> {
  const tokenUrl = `${authority.replace(/\/+$/, '')}/oauth/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      audience,
      ...(scope ? { scope } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Dohvat tokena nije uspio, status: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error(`Odgovor ne sadrži access_token, status: ${response.status}`);
  }

  return data.access_token;
}

export async function issuePass(
  url: string,
  token: string,
  name: string,
  document: string
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, document }),
  });

  if (response.status !== 201) {
    throw new Error(`Izdavanje propusnice nije uspjelo, status: ${response.status} ${response.statusText}`);
  }

  const location = response.headers.get('Location');
  if (!location) {
    throw new Error(`Odgovor ne sadrži zaglavlje Location, status: ${response.status}`);
  }

  const id = new URL(location, url).pathname.split('/').filter(Boolean).pop();
  if (!id) {
    throw new Error(`Iz zaglavlja Location nije moguće očitati identifikator, status: ${response.status}`);
  }

  const image = Buffer.from(await response.arrayBuffer());
  await writeFile(`${id}.png`, image);
}