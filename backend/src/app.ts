import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import hexRoutes from './routes/hexes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/data', hexRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is reachable!' });
});

// Explicitly parse PORT as a number to satisfy TypeScript
const PORT: number = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
const HOST: string = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Accessible on LAN at http://YOUR_LAN_IP:${PORT}`);
});