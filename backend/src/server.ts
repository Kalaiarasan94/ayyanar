import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api';
import { initDb } from './db';

const app = express();
// Hostinger (and most hosts) inject the port via the PORT env variable
const PORT = parseInt(process.env.PORT || '5000');

app.use(cors());
app.use(express.json());

// Attach all endpoints prefixed with /api
app.use('/api', apiRoutes);

// Health check used by the hosting platform
app.get('/', (req, res) => {
  res.status(200).send('MySQL Construction ERP Engine Live.');
});

app.listen(PORT, async () => {
  console.log(`=========================================`);
  console.log(`🚀 BACKEND SERVER ACTIVE on port ${PORT}`);
  console.log(`📡 Linked cleanly to your MySQL Database`);
  console.log(`=========================================`);

  // Run Database Schema migrations
  await initDb();
});
