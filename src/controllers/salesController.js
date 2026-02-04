import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const salesController = {
  // Get all sales
  async getAllSales(req, res, next) {
    try {
      const { 
        startDate, 
        endDate, 
        status, 
        customerId,
        page = 1, 
        limit = 50 
      } = req.query;

      const where = {};

      if (startDate || endDate) {
        where.saleDate = {};
        if (startDate) where.saleDate.gte = new Date(startDate);
        if (endDate) where.saleDate.lte = new Date(endDate);
      }

      if (status) where.paymentStatus = status;
      if (customerId) where.customerId = customerId;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [sales, total] = await Promise.all([
        prisma.sale.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { saleDate: 'desc' },
          include: {
            product: true,
            lender: true,
            returns: true
          }
        }),
        prisma.sale.count({ where })
      ]);

      res.json({
        sales,
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

  // Get single sale
  async getSale(req, res, next) {
    try {
      const { id } = req.params;

      const sale = await prisma.sale.findUnique({
        where: { id },
        include: {
          product: true,
          lender: true,
          returns: true
        }
      });

      if (!sale) {
        return res.status(404).json({ error: 'Sale not found' });
      }

      res.json(sale);
    } catch (error) {
      next(error);
    }
  },

  // Create sale
  async createSale(req, res, next) {
    try {
      const {
        productId,
        quantity,
        unitPrice,
        customerId,
        customerName,
        paymentMethod,
        paymentStatus,
        amountPaid,
        notes
      } = req.body;

      // Calculate totals
      const totalAmount = parseFloat(quantity) * parseFloat(unitPrice);
      const amountDue = totalAmount - parseFloat(amountPaid || 0);

      // Generate sale number
      const lastSale = await prisma.sale.findFirst({
        orderBy: { createdAt: 'desc' }
      });
      const saleNumber = `SALE-${Date.now()}`;

      // Start transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create sale
        const sale = await tx.sale.create({
          data: {
            saleNumber,
            productId,
            quantity: parseInt(quantity),
            unitPrice,
            totalAmount,
            customerId,
            customerName,
            paymentMethod,
            paymentStatus,
            amountPaid: amountPaid || 0,
            amountDue,
            soldBy: req.user.id,
            notes
          },
          include: {
            product: true,
            lender: true
          }
        });

        // Update product stock
        await tx.product.update({
          where: { id: productId },
          data: {
            currentStock: {
              decrement: parseInt(quantity)
            }
          }
        });

        // Record stock movement
        await tx.stockMovement.create({
          data: {
            productId,
            type: 'OUT',
            quantity: -parseInt(quantity),
            reason: 'SALE',
            reference: sale.id,
            createdBy: req.user.id
          }
        });

        // Update lender if credit sale
        if (customerId && paymentStatus !== 'PAID') {
          await tx.lender.update({
            where: { id: customerId },
            data: {
              currentDebt: { increment: amountDue },
              totalPurchased: { increment: totalAmount }
            }
          });
        }

        return sale;
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  // Update payment status
  async updatePayment(req, res, next) {
    try {
      const { id } = req.params;
      const { amountPaid, paymentMethod } = req.body;

      const sale = await prisma.sale.findUnique({ where: { id } });
      if (!sale) {
        return res.status(404).json({ error: 'Sale not found' });
      }

      const newAmountPaid = parseFloat(sale.amountPaid) + parseFloat(amountPaid);
      const newAmountDue = parseFloat(sale.totalAmount) - newAmountPaid;
      const paymentStatus = newAmountDue <= 0 ? 'PAID' : 'PARTIAL';

      const result = await prisma.$transaction(async (tx) => {
        // Update sale
        const updatedSale = await tx.sale.update({
          where: { id },
          data: {
            amountPaid: newAmountPaid,
            amountDue: newAmountDue,
            paymentStatus,
            paymentMethod
          }
        });

        // Update lender debt if applicable
        if (sale.customerId) {
          await tx.lender.update({
            where: { id: sale.customerId },
            data: {
              currentDebt: { decrement: parseFloat(amountPaid) },
              totalPaid: { increment: parseFloat(amountPaid) }
            }
          });

          // Record payment
          const paymentNumber = `PAY-${Date.now()}`;
          await tx.payment.create({
            data: {
              paymentNumber,
              lenderId: sale.customerId,
              amount: parseFloat(amountPaid),
              paymentMethod,
              reference: sale.saleNumber,
              receivedBy: req.user.id
            }
          });
        }

        return updatedSale;
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  // Get sales summary
  async getSalesSummary(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      const where = {};
      if (startDate || endDate) {
        where.saleDate = {};
        if (startDate) where.saleDate.gte = new Date(startDate);
        if (endDate) where.saleDate.lte = new Date(endDate);
      }

      const [totalSales, totalRevenue, pendingPayments] = await Promise.all([
        prisma.sale.count({ where }),
        prisma.sale.aggregate({
          where,
          _sum: { totalAmount: true }
        }),
        prisma.sale.aggregate({
          where: { 
            ...where,
            paymentStatus: { not: 'PAID' }
          },
          _sum: { amountDue: true }
        })
      ]);

      res.json({
        totalSales,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        pendingPayments: pendingPayments._sum.amountDue || 0
      });
    } catch (error) {
      next(error);
    }
  }
};
