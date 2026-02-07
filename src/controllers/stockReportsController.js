import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to get week number
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export const stockReportsController = {
  // Get all weekly reports
  async getAllReports(req, res, next) {
    try {
      const { year, page = 1, limit = 20 } = req.query;

      const where = {};
      if (year) where.year = parseInt(year);

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [reports, total] = await Promise.all([
        prisma.weeklyStockReport.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: [{ year: 'desc' }, { weekNumber: 'desc' }],
        }),
        prisma.weeklyStockReport.count({ where }),
      ]);

      res.json({
        reports,
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

  // Get single report
  async getReport(req, res, next) {
    try {
      const { id } = req.params;

      const report = await prisma.weeklyStockReport.findUnique({
        where: { id },
      });

      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Get product details for opening and closing stock
      const productIds = [
        ...Object.keys(report.openingStock),
        ...Object.keys(report.closingStock),
      ];
      const uniqueProductIds = [...new Set(productIds)];

      const products = await prisma.product.findMany({
        where: { id: { in: uniqueProductIds } },
        select: {
          id: true,
          itemName: true,
          sellingPrice: true,
          costPrice: true,
        },
      });

      const productsMap = products.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

      // Get additional stock for this week
      const additionalStock = await prisma.additionalStock.findMany({
        where: {
          weekNumber: report.weekNumber,
          year: report.year,
        },
        include: {
          product: {
            select: {
              itemName: true,
              category: true,
            },
          },
        },
        orderBy: { purchaseDate: 'desc' },
      });

      const additionalStockValue = additionalStock.reduce(
        (sum, stock) => sum + parseFloat(stock.totalCost),
        0,
      );

      res.json({
        ...report,
        productsMap,
        additionalStock,
        additionalStockValue,
      });
    } catch (error) {
      next(error);
    }
  },

  // Create new weekly report
  async createReport(req, res, next) {
    try {
      const { startDate, endDate, notes } = req.body;

      const start = new Date(startDate);
      const end = new Date(endDate);
      const weekNumber = getWeekNumber(start);
      const year = start.getFullYear();

      // Check if report already exists
      const existing = await prisma.weeklyStockReport.findUnique({
        where: {
          weekNumber_year: { weekNumber, year },
        },
      });

      if (existing) {
        return res.status(400).json({
          error: 'Report already exists for this week',
        });
      }

      // Get all products and their current stock
      const products = await prisma.product.findMany({
        select: {
          id: true,
          currentStock: true,
          costPrice: true,
        },
      });

      // Create opening stock snapshot
      const openingStock = {};
      let totalValue = 0;

      products.forEach(product => {
        openingStock[product.id] = product.currentStock;
        totalValue += parseFloat(product.currentStock) * parseFloat(product.costPrice);
      });

      const report = await prisma.weeklyStockReport.create({
        data: {
          weekNumber,
          year,
          startDate: start,
          endDate: end,
          openingStock,
          closingStock: {}, // Will be updated at end of week
          totalValue,
          notes,
        },
      });

      res.status(201).json(report);
    } catch (error) {
      next(error);
    }
  },

  // Close weekly report (capture closing stock)
  async closeReport(req, res, next) {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      const report = await prisma.weeklyStockReport.findUnique({
        where: { id },
      });

      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Get current stock for all products
      const products = await prisma.product.findMany({
        select: {
          id: true,
          currentStock: true,
          costPrice: true,
        },
      });

      const closingStock = {};

      products.forEach(product => {
        closingStock[product.id] = product.currentStock;
      });

      const updatedReport = await prisma.weeklyStockReport.update({
        where: { id },
        data: {
          closingStock,
          notes: notes || report.notes,
        },
      });

      res.json(updatedReport);
    } catch (error) {
      next(error);
    }
  },

  // Get current week report
  async getCurrentWeekReport(req, res, next) {
    try {
      const now = new Date();
      const weekNumber = getWeekNumber(now);
      const year = now.getFullYear();

      let report = await prisma.weeklyStockReport.findUnique({
        where: {
          weekNumber_year: { weekNumber, year },
        },
      });

      // If no report exists, create one
      if (!report) {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const products = await prisma.product.findMany({
          select: {
            id: true,
            currentStock: true,
            costPrice: true,
          },
        });

        const openingStock = {};
        let totalValue = 0;

        products.forEach(product => {
          openingStock[product.id] = product.currentStock;
          totalValue += parseFloat(product.currentStock) * parseFloat(product.costPrice);
        });

        report = await prisma.weeklyStockReport.create({
          data: {
            weekNumber,
            year,
            startDate: startOfWeek,
            endDate: endOfWeek,
            openingStock,
            closingStock: {},
            totalValue,
          },
        });
      }

      // Get additional stock for this week
      const additionalStock = await prisma.additionalStock.findMany({
        where: {
          weekNumber: report.weekNumber,
          year: report.year,
        },
        include: {
          product: {
            select: {
              itemName: true,
              category: true,
            },
          },
        },
        orderBy: { purchaseDate: 'desc' },
      });

      const additionalStockValue = additionalStock.reduce(
        (sum, stock) => sum + parseFloat(stock.totalCost),
        0,
      );

      res.json({
        ...report,
        additionalStock,
        additionalStockValue,
      });
    } catch (error) {
      next(error);
    }
  },

  // Get stock variance report
  async getStockVariance(req, res, next) {
    try {
      const { id } = req.params;

      const report = await prisma.weeklyStockReport.findUnique({
        where: { id },
      });

      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Get product details
      const productIds = Object.keys(report.openingStock);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
      });

      // Calculate variances
      const variances = products.map(product => {
        const opening = report.openingStock[product.id] || 0;
        const closing = report.closingStock[product.id] || 0;
        const variance = closing - opening;
        const varianceValue = variance * parseFloat(product.costPrice);

        return {
          productId: product.id,
          productName: product.itemName,
          opening,
          closing,
          variance,
          varianceValue,
        };
      });

      res.json({
        report,
        variances: variances.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)),
      });
    } catch (error) {
      next(error);
    }
  },

  // Get additional stock for a week
  async getWeeklyAdditionalStock(req, res, next) {
    try {
      const { weekNumber, year } = req.query;

      const additionalStock = await prisma.additionalStock.findMany({
        where: {
          weekNumber: parseInt(weekNumber),
          year: parseInt(year),
        },
        include: {
          product: {
            select: {
              itemName: true,
              category: true,
            },
          },
        },
        orderBy: { purchaseDate: 'desc' },
      });

      const totalCost = additionalStock.reduce(
        (sum, stock) => sum + parseFloat(stock.totalCost),
        0,
      );

      res.json({
        additionalStock,
        totalCost,
        totalItems: additionalStock.length,
      });
    } catch (error) {
      next(error);
    }
  },

  // Create additional stock record
  async createAdditionalStock(req, res, next) {
    try {
      const {
        productId,
        quantity,
        costPerUnit,
        supplier,
        invoiceNumber,
        notes,
        purchaseDate,
      } = req.body;

      // Validate required fields
      if (!productId || !quantity || !costPerUnit) {
        return res.status(400).json({
          message: 'Product, quantity, and cost per unit are required',
        });
      }

      // Check if product exists
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      // Calculate totals
      const totalCost = parseFloat(quantity) * parseFloat(costPerUnit);
      const purchase = new Date(purchaseDate || new Date());
      const weekNumber = getWeekNumber(purchase);
      const year = purchase.getFullYear();

      // Generate unique batch number
      const batchNumber = `BATCH-${Date.now()}`;

      // Create additional stock record in transaction
      const result = await prisma.$transaction(async tx => {
        // Record the additional stock
        const additionalStock = await tx.additionalStock.create({
          data: {
            batchNumber,
            productId,
            quantity: parseInt(quantity),
            costPerUnit: parseFloat(costPerUnit),
            totalCost,
            supplier: supplier || null,
            invoiceNumber: invoiceNumber || null,
            weekNumber,
            year,
            notes: notes || null,
            purchaseDate: purchase,
          },
          include: {
            product: {
              select: {
                itemName: true,
                category: true,
              },
            },
          },
        });

        // Update product stock
        await tx.product.update({
          where: { id: productId },
          data: {
            currentStock: {
              increment: parseInt(quantity),
            },
          },
        });

        // Record stock movement
        const product = await tx.product.findUnique({
          where: { id: productId },
        });

        await tx.stockMovement.create({
          data: {
            productId,
            type: 'IN',
            quantity: parseInt(quantity),
            reason: 'PURCHASE',
            reference: additionalStock.id,
            createdBy: req.user.id,
            quantityBefore: product.currentStock - parseInt(quantity),
            quantityAfter: product.currentStock,
          },
        });

        return additionalStock;
      });

      res.status(201).json({
        message: 'Additional stock recorded successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  // Update additional stock record
  async updateAdditionalStock(req, res, next) {
    try {
      const { id } = req.params;
      const { quantity, costPerUnit, supplier, invoiceNumber, notes } = req.body;

      // Find existing record
      const existing = await prisma.additionalStock.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ message: 'Additional stock record not found' });
      }

      const newTotalCost =
        parseFloat(quantity || existing.quantity) *
        parseFloat(costPerUnit || existing.costPerUnit);

      const updated = await prisma.additionalStock.update({
        where: { id },
        data: {
          quantity: quantity ? parseInt(quantity) : existing.quantity,
          costPerUnit: costPerUnit ? parseFloat(costPerUnit) : existing.costPerUnit,
          totalCost: newTotalCost,
          supplier: supplier !== undefined ? supplier : existing.supplier,
          invoiceNumber:
            invoiceNumber !== undefined ? invoiceNumber : existing.invoiceNumber,
          notes: notes !== undefined ? notes : existing.notes,
        },
        include: {
          product: {
            select: {
              itemName: true,
              category: true,
            },
          },
        },
      });

      res.json({
        message: 'Additional stock updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  // Delete additional stock record
  async deleteAdditionalStock(req, res, next) {
    try {
      const { id } = req.params;

      const existing = await prisma.additionalStock.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ message: 'Additional stock record not found' });
      }

      // Delete in transaction to update stock and movements
      await prisma.$transaction(async tx => {
        // Update product stock back
        await tx.product.update({
          where: { id: existing.productId },
          data: {
            currentStock: {
              decrement: existing.quantity,
            },
          },
        });

        // Delete the additional stock record
        await tx.additionalStock.delete({
          where: { id },
        });
      });

      res.json({ message: 'Additional stock record deleted successfully' });
    } catch (error) {
      next(error);
    }
  },
};
