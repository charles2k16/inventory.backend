import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const productController = {
  // Get all products
  async getAllProducts(req, res, next) {
    try {
      const { 
        search, 
        category, 
        lowStock, 
        page = 1, 
        limit = 50 
      } = req.query;

      const where = {};

      if (search) {
        where.OR = [
          { itemName: { contains: search, mode: 'insensitive' } },
          { itemDescription: { contains: search, mode: 'insensitive' } },
          { barcodeNumber: { contains: search, mode: 'insensitive' } }
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
                additionalStock: true
              }
            }
          }
        }),
        prisma.product.count({ where })
      ]);

      res.json({
        products,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
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
            take: 20
          },
          sales: {
            orderBy: { saleDate: 'desc' },
            take: 10
          },
          returns: {
            orderBy: { returnDate: 'desc' },
            take: 10
          },
          additionalStock: {
            orderBy: { purchaseDate: 'desc' },
            take: 10
          }
        }
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
        data: req.body
      });

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
        data: req.body
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
        where: { id }
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
        distinct: ['category']
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
            lte: prisma.product.fields.reorderLevel
          }
        },
        orderBy: { currentStock: 'asc' }
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
        skipDuplicates: true
      });

      res.status(201).json({ 
        message: `${result.count} products imported successfully`,
        count: result.count 
      });
    } catch (error) {
      next(error);
    }
  }
};
