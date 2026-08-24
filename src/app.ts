import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import shopRoutes from './routes/shops';
import productRoutes from './routes/products';
import aiRoutes from './routes/ai';
import whatsappRoutes from './routes/whatsapp';
import saleRoutes from './routes/sales';
import { errorHandler } from './middleware/errorHandler';
import { seedBusinessTypes } from './services/shopService';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

app.use('/api/auth', authRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/shops/me', productRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/shops/me/sales', saleRoutes);

// Error handling
app.use(errorHandler);

// Start server
app.listen(port, async () => {
  console.log(`[SERVER] Running on http://localhost:${port}`);
  try {
    await seedBusinessTypes();
  } catch (error) {
    console.error('[SERVER] Failed to seed business types:', error);
  }
});


