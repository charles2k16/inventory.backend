// Product Routes
import express from 'express';
import { productController } from '../controllers/productController.js';

const router = express.Router();

router.get('/', productController.getAllProducts);
router.get('/categories', productController.getCategories);
router.get('/low-stock', productController.getLowStockProducts);
router.get('/:id', productController.getProduct);
router.post('/', productController.createProduct);
router.post('/bulk-import', productController.bulkImport);
router.patch('/:id/update-stock', productController.updateStock);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

export default router;
