import express from 'express';
import { getStats } from './db.js';

const app = express();
const port = process.env.PORT || 3000;

app.get('/', async (req, res) => {
  const stats = await getStats();
  res.send(`Ukupno propusnica: ${stats.total}, aktivnih: ${stats.active}`);
});

app.listen(port, () => {
  console.log(`Server radi na http://localhost:${port}`);
});