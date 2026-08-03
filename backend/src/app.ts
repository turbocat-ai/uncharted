import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.js'
import hexRoutes from './routes/hexes.js'

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/data', hexRoutes)

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});