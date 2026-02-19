// Product Routes
import express from 'express';
import multer from 'multer';
import path from 'path';
import { productController } from '../controllers/productController.js';
import { roleMiddleware } from '../middleware/auth.js';
import { CAN_MANAGE_PRODUCTS } from '../constants/roles.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `product-import-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const allowedExts = ['.csv', '.xls', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

router.get('/', productController.getAllProducts);
router.get('/categories', productController.getCategories);
router.get('/low-stock', productController.getLowStockProducts);
router.get('/import/template', productController.getImportTemplate);
router.get('/:id', productController.getProduct);
router.post('/', roleMiddleware(CAN_MANAGE_PRODUCTS), productController.createProduct);
router.post('/bulk-import', roleMiddleware(CAN_MANAGE_PRODUCTS), upload.single('file'), productController.bulkImport);
router.patch('/:id/update-stock', roleMiddleware(CAN_MANAGE_PRODUCTS), productController.updateStock);
router.put('/:id', roleMiddleware(CAN_MANAGE_PRODUCTS), productController.updateProduct);
router.delete('/:id', roleMiddleware(CAN_MANAGE_PRODUCTS), productController.deleteProduct);

export default router;
