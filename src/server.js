import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

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

// Serve frontend static files (when built into backend/public for single-app deploy)
const publicDir = path.join(__dirname, '..', 'public');
const indexPath = path.join(publicDir, 'index.html');
if (fs.existsSync(publicDir) && fs.existsSync(indexPath)) {
  app.use(express.static(publicDir));
  // SPA fallback: only for page routes – don't send HTML for asset requests (.json, .js, .css, etc.)
  // so _payload.json and other static files get proper 404 when missing instead of HTML
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next();
    if (/\.(json|js|css|ico|png|jpg|jpeg|gif|svg|woff2?|ttf|eot)$/i.test(req.path)) return next();
    res.sendFile(indexPath);
  });
}

// Error handling
app.use(errorHandler);

// 404 handler (API routes only; frontend gets index.html via fallback above)
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🏪 App: ${process.env.APP_NAME}`);
});
