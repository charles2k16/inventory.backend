import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const productController = {
  // Get all products
  async getAllProducts(req, res, next) {
    try {
      const { search, category, lowStock, page = 1, limit = 50 } = req.query;

      const where = {};

      if (search) {
        where.OR = [
          { itemName: { contains: search, mode: 'insensitive' } },
          { itemDescription: { contains: search, mode: 'insensitive' } },
          { barcodeNumber: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (category) {
        where.category = category;
      }

      if (lowStock === 'true') {
        where.currentStock = { lte: prisma.product.fields.reorderLevel };
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { itemName: 'asc' },
          include: {
            _count: {
              select: {
                sales: true,
                returns: true,
                additionalStock: true,
              },
            },
          },
        }),
        prisma.product.count({ where }),
      ]);

      res.json({
        products,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // Get single product
  async getProduct(req, res, next) {
    try {
      const { id } = req.params;

      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          stockMovements: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
          sales: {
            orderBy: { saleDate: 'desc' },
            take: 10,
          },
          returns: {
            orderBy: { returnDate: 'desc' },
            take: 10,
          },
          additionalStock: {
            orderBy: { purchaseDate: 'desc' },
            take: 10,
          },
        },
      });

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json(product);
    } catch (error) {
      next(error);
    }
  },

  // Create product
  async createProduct(req, res, next) {
    try {
      const product = await prisma.product.create({
        data: req.body,
      });

      // Create initial stock movement record if stock > 0
      if (product.currentStock > 0) {
        await prisma.stockMovement.create({
          data: {
            productId: product.id,
            type: 'IN',
            quantity: product.currentStock,
            quantityBefore: 0,
            quantityAfter: product.currentStock,
            reason: 'PURCHASE',
            notes: 'Initial stock entry',
            createdBy: req.user?.username || 'System',
          },
        });
      }

      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  },

  // Update product
  async updateProduct(req, res, next) {
    try {
      const { id } = req.params;

      const product = await prisma.product.update({
        where: { id },
        data: req.body,
      });

      res.json(product);
    } catch (error) {
      next(error);
    }
  },

  // Delete product
  async deleteProduct(req, res, next) {
    try {
      const { id } = req.params;

      await prisma.product.delete({
        where: { id },
      });

      res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      next(error);
    }
  },

  // Get product categories
  async getCategories(req, res, next) {
    try {
      const categories = await prisma.product.findMany({
        select: { category: true },
        distinct: ['category'],
      });

      res.json(categories.map(c => c.category));
    } catch (error) {
      next(error);
    }
  },

  // Get low stock products
  async getLowStockProducts(req, res, next) {
    try {
      const products = await prisma.product.findMany({
        where: {
          currentStock: {
            lte: prisma.product.fields.reorderLevel,
          },
        },
        orderBy: { currentStock: 'asc' },
      });

      res.json(products);
    } catch (error) {
      next(error);
    }
  },

  // Bulk import products
  async bulkImport(req, res, next) {
    try {
      const { products } = req.body;

      const result = await prisma.product.createMany({
        data: products,
        skipDuplicates: true,
      });

      res.status(201).json({
        message: `${result.count} products imported successfully`,
        count: result.count,
      });
    } catch (error) {
      next(error);
    }
  },

  // Update stock
  async updateStock(req, res, next) {
    try {
      const { id } = req.params;
      const { quantity, type, reason, notes } = req.body;

      // Validate input
      if (!quantity || !type) {
        return res.status(400).json({ message: 'Quantity and type are required' });
      }

      // Get current product
      const product = await prisma.product.findUnique({
        where: { id },
      });

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      // Calculate new stock
      const newStock =
        type === 'IN' ? product.currentStock + quantity : product.currentStock - quantity;

      if (newStock < 0) {
        return res.status(400).json({ message: 'Stock cannot be negative' });
      }

      // Update product stock
      const updatedProduct = await prisma.product.update({
        where: { id },
        data: {
          currentStock: newStock,
        },
      });

      // Create stock movement record
      const movement = await prisma.stockMovement.create({
        data: {
          productId: id,
          type,
          quantity,
          quantityBefore: product.currentStock,
          quantityAfter: newStock,
          reason: reason || null,
          notes: notes || null,
          createdBy: req.user?.username || 'System',
        },
      });

      res.json({
        product: updatedProduct,
        movement,
      });
    } catch (error) {
      next(error);
    }
  },
};
