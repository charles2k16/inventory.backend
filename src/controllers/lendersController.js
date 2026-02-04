import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const lendersController = {
  // Get all lenders
  async getAllLenders(req, res, next) {
    try {
      const { status, search, page = 1, limit = 50 } = req.query;

      const where = {};
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { customerCode: { contains: search, mode: 'insensitive' } }
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [lenders, total] = await Promise.all([
        prisma.lender.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { name: 'asc' },
          include: {
            _count: {
              select: { sales: true, payments: true }
            }
          }
        }),
        prisma.lender.count({ where })
      ]);

      res.json({
        lenders,
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

  // Get single lender with full details
  async getLender(req, res, next) {
    try {
      const { id } = req.params;

      const lender = await prisma.lender.findUnique({
        where: { id },
        include: {
          sales: {
            orderBy: { saleDate: 'desc' },
            take: 20,
            include: { product: true }
          },
          payments: {
            orderBy: { paymentDate: 'desc' },
            take: 20
          }
        }
      });

      if (!lender) {
        return res.status(404).json({ error: 'Lender not found' });
      }

      res.json(lender);
    } catch (error) {
      next(error);
    }
  },

  // Create lender
  async createLender(req, res, next) {
    try {
      const { name, phone, email, address, creditLimit, notes } = req.body;

      // Generate customer code
      const lastLender = await prisma.lender.findFirst({
        orderBy: { createdAt: 'desc' }
      });
      const customerCode = `CUST-${(lastLender ? parseInt(lastLender.customerCode.split('-')[1]) + 1 : 1).toString().padStart(5, '0')}`;

      const lender = await prisma.lender.create({
        data: {
          customerCode,
          name,
          phone,
          email,
          address,
          creditLimit: creditLimit || 0,
          notes
        }
      });

      res.status(201).json(lender);
    } catch (error) {
      next(error);
    }
  },

  // Update lender
  async updateLender(req, res, next) {
    try {
      const { id } = req.params;

      const lender = await prisma.lender.update({
        where: { id },
        data: req.body
      });

      res.json(lender);
    } catch (error) {
      next(error);
    }
  },

  // Record payment
  async recordPayment(req, res, next) {
    try {
      const { id } = req.params;
      const { amount, paymentMethod, reference, notes } = req.body;

      const paymentNumber = `PAY-${Date.now()}`;

      const result = await prisma.$transaction(async (tx) => {
        // Create payment
        const payment = await tx.payment.create({
          data: {
            paymentNumber,
            lenderId: id,
            amount: parseFloat(amount),
            paymentMethod,
            reference,
            notes,
            receivedBy: req.user.id
          }
        });

        // Update lender debt
        await tx.lender.update({
          where: { id },
          data: {
            currentDebt: { decrement: parseFloat(amount) },
            totalPaid: { increment: parseFloat(amount) }
          }
        });

        return payment;
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  // Get lenders with debt
  async getLendersWithDebt(req, res, next) {
    try {
      const lenders = await prisma.lender.findMany({
        where: {
          currentDebt: { gt: 0 }
        },
        orderBy: { currentDebt: 'desc' }
      });

      const totalDebt = lenders.reduce((sum, l) => sum + parseFloat(l.currentDebt), 0);

      res.json({ lenders, totalDebt });
    } catch (error) {
      next(error);
    }
  },

  // Suspend/activate lender
  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const lender = await prisma.lender.update({
        where: { id },
        data: { status }
      });

      res.json(lender);
    } catch (error) {
      next(error);
    }
  }
};
