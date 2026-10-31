import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Aplikacija radi!');
});

app.listen(port, () => {
  console.log(`Server radi na http://localhost:${port}`);
});