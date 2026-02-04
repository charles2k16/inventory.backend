import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Get inventory valuation
router.get('/valuation', async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      select: {
        currentStock: true,
        costPrice: true,
        sellingPrice: true
      }
    });

    const costValue = products.reduce((sum, p) => {
      return sum + (parseFloat(p.currentStock) * parseFloat(p.costPrice));
    }, 0);

    const sellingValue = products.reduce((sum, p) => {
      return sum + (parseFloat(p.currentStock) * parseFloat(p.sellingPrice));
    }, 0);

    const potentialProfit = sellingValue - costValue;

    res.json({
      costValue,
      sellingValue,
      potentialProfit,
      totalItems: products.reduce((sum, p) => sum + p.currentStock, 0)
    });
  } catch (error) {
    next(error);
  }
});

// Stock movements history
router.get('/movements', async (req, res, next) => {
  try {
    const { productId, type, startDate, endDate, page = 1, limit = 50 } = req.query;

    const where = {};
    if (productId) where.productId = productId;
    if (type) where.type = type;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { itemName: true } }
        }
      }),
      prisma.stockMovement.count({ where })
    ]);

    res.json({
      movements,
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
});

// Add additional stock
router.post('/additional-stock', async (req, res, next) => {
  try {
    const {
      productId,
      quantity,
      costPerUnit,
      supplier,
      invoiceNumber,
      notes
    } = req.body;

    const now = new Date();
    const weekNumber = Math.ceil(now.getDate() / 7);
    const year = now.getFullYear();

    const batchNumber = `BATCH-${Date.now()}`;
    const totalCost = parseFloat(quantity) * parseFloat(costPerUnit);

    const result = await prisma.$transaction(async (tx) => {
      // Create additional stock record
      const additionalStock = await tx.additionalStock.create({
        data: {
          batchNumber,
          productId,
          quantity: parseInt(quantity),
          costPerUnit,
          totalCost,
          supplier,
          invoiceNumber,
          weekNumber,
          year,
          notes
        },
        include: {
          product: true
        }
      });

      // Update product stock
      await tx.product.update({
        where: { id: productId },
        data: {
          currentStock: { increment: parseInt(quantity) }
        }
      });

      // Record stock movement
      await tx.stockMovement.create({
        data: {
          productId,
          type: 'IN',
          quantity: parseInt(quantity),
          reason: 'PURCHASE',
          reference: additionalStock.id,
          notes: `Additional stock: ${supplier || 'Unknown supplier'}`,
          createdBy: req.user.id
        }
      });

      return additionalStock;
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
