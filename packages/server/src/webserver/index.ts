import express from 'express';
import cors from 'cors';

export const startWebServer = () => {
  const app = express();
  
  app.use(cors());
  const PORT = 3000;

  app.get('/', (req, res) => {
    res.send('Rust Server Query Web Server is running.');
  });

  app.listen(PORT, () => {
    console.log(`Web server is listening on port ${PORT}`);
  });
};
