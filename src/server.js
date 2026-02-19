import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Import routes
import productRoutes from './routes/products.js';
import inventoryRoutes from './routes/inventory.js';
import salesRoutes from './routes/sales.js';
import returnsRoutes from './routes/returns.js';
import lendersRoutes from './routes/lenders.js';
import stockReportsRoutes from './routes/stockReports.js';
import dashboardRoutes from './routes/dashboard.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import activityRoutes from './routes/activity.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, usersRoutes);
app.use('/api/products', authMiddleware, productRoutes);
app.use('/api/inventory', authMiddleware, inventoryRoutes);
app.use('/api/sales', authMiddleware, salesRoutes);
app.use('/api/returns', authMiddleware, returnsRoutes);
app.use('/api/lenders', authMiddleware, lendersRoutes);
app.use('/api/stock-reports', authMiddleware, stockReportsRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/activity', authMiddleware, activityRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🏪 App: ${process.env.APP_NAME}`);
});
