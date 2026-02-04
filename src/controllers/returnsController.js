import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const returnsController = {
  // Get all returns
  async getAllReturns(req, res, next) {
    try {
      const { status, startDate, endDate, page = 1, limit = 50 } = req.query;

      const where = {};
      if (status) where.status = status;
      if (startDate || endDate) {
        where.returnDate = {};
        if (startDate) where.returnDate.gte = new Date(startDate);
        if (endDate) where.returnDate.lte = new Date(endDate);
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [returns, total] = await Promise.all([
        prisma.return.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { returnDate: 'desc' },
          include: {
            product: true,
            sale: true
          }
        }),
        prisma.return.count({ where })
      ]);

      res.json({
        returns,
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

  // Create return
  async createReturn(req, res, next) {
    try {
      const {
        saleId,
        productId,
        quantity,
        reason,
        refundAmount,
        refundMethod,
        notes
      } = req.body;

      const returnNumber = `RET-${Date.now()}`;

      const result = await prisma.$transaction(async (tx) => {
        // Create return
        const returnRecord = await tx.return.create({
          data: {
            returnNumber,
            saleId,
            productId,
            quantity: parseInt(quantity),
            reason,
            refundAmount,
            refundMethod,
            status: 'PENDING',
            returnedBy: req.user.id,
            notes
          },
          include: {
            product: true,
            sale: true
          }
        });

        // Update product stock (add back)
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
            reason: 'RETURN',
            reference: returnRecord.id,
            createdBy: req.user.id
          }
        });

        return returnRecord;
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  // Approve return
  async approveReturn(req, res, next) {
    try {
      const { id } = req.params;

      const returnRecord = await prisma.return.update({
        where: { id },
        data: { status: 'APPROVED' }
      });

      res.json(returnRecord);
    } catch (error) {
      next(error);
    }
  },

  // Complete return (refund processed)
  async completeReturn(req, res, next) {
    try {
      const { id } = req.params;

      const returnRecord = await prisma.return.update({
        where: { id },
        data: { status: 'COMPLETED' }
      });

      res.json(returnRecord);
    } catch (error) {
      next(error);
    }
  }
};
