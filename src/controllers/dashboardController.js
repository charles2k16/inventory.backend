import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dashboardController = {
  // Get main dashboard stats
  async getDashboardStats(req, res, next) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - today.getDay());
      
      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      // Get all stats in parallel
      const [
        totalProducts,
        totalStockValue,
        lowStockCount,
        todaySales,
        weekSales,
        monthSales,
        pendingReturns,
        totalDebt,
        topSellingProducts,
        recentSales,
        lowStockProducts
      ] = await Promise.all([
        // Total products count
        prisma.product.count(),

        // Total stock value
        prisma.product.aggregate({
          _sum: {
            currentStock: true
          }
        }).then(async (result) => {
          const products = await prisma.product.findMany({
            select: { currentStock: true, costPrice: true }
          });
          return products.reduce((sum, p) => {
            return sum + (parseFloat(p.currentStock) * parseFloat(p.costPrice));
          }, 0);
        }),

        // Low stock count
        prisma.product.count({
          where: {
            currentStock: {
              lte: prisma.product.fields.reorderLevel
            }
          }
        }),

        // Today's sales
        prisma.sale.aggregate({
          where: {
            saleDate: { gte: today }
          },
          _sum: { totalAmount: true },
          _count: true
        }),

        // This week's sales
        prisma.sale.aggregate({
          where: {
            saleDate: { gte: thisWeekStart }
          },
          _sum: { totalAmount: true },
          _count: true
        }),

        // This month's sales
        prisma.sale.aggregate({
          where: {
            saleDate: { gte: thisMonthStart }
          },
          _sum: { totalAmount: true },
          _count: true
        }),

        // Pending returns
        prisma.return.count({
          where: { status: 'PENDING' }
        }),

        // Total outstanding debt
        prisma.lender.aggregate({
          _sum: { currentDebt: true }
        }),

        // Top selling products (last 30 days)
        prisma.sale.groupBy({
          by: ['productId'],
          where: {
            saleDate: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          },
          _sum: {
            quantity: true,
            totalAmount: true
          },
          orderBy: {
            _sum: {
              quantity: 'desc'
            }
          },
          take: 5
        }).then(async (results) => {
          const productIds = results.map(r => r.productId);
          const products = await prisma.product.findMany({
            where: { id: { in: productIds } }
          });
          
          return results.map(r => {
            const product = products.find(p => p.id === r.productId);
            return {
              product,
              quantitySold: r._sum.quantity,
              totalRevenue: r._sum.totalAmount
            };
          });
        }),

        // Recent sales (last 10)
        prisma.sale.findMany({
          take: 10,
          orderBy: { saleDate: 'desc' },
          include: {
            product: { select: { itemName: true } },
            lender: { select: { name: true } }
          }
        }),

        // Low stock products
        prisma.product.findMany({
          where: {
            currentStock: {
              lte: prisma.product.fields.reorderLevel
            }
          },
          orderBy: { currentStock: 'asc' },
          take: 10
        })
      ]);

      res.json({
        overview: {
          totalProducts,
          totalStockValue: totalStockValue.toFixed(2),
          lowStockCount,
          pendingReturns,
          totalDebt: totalDebt._sum.currentDebt || 0
        },
        sales: {
          today: {
            count: todaySales._count,
            amount: todaySales._sum.totalAmount || 0
          },
          thisWeek: {
            count: weekSales._count,
            amount: weekSales._sum.totalAmount || 0
          },
          thisMonth: {
            count: monthSales._count,
            amount: monthSales._sum.totalAmount || 0
          }
        },
        topSellingProducts,
        recentSales,
        lowStockProducts
      });
    } catch (error) {
      next(error);
    }
  },

  // Get sales chart data
  async getSalesChartData(req, res, next) {
    try {
      const { period = 'week' } = req.query; // week, month, year
      
      const now = new Date();
      let startDate;
      let groupBy;

      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          groupBy = 'day';
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          groupBy = 'day';
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          groupBy = 'month';
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          groupBy = 'day';
      }

      const sales = await prisma.sale.findMany({
        where: {
          saleDate: { gte: startDate }
        },
        select: {
          saleDate: true,
          totalAmount: true
        },
        orderBy: { saleDate: 'asc' }
      });

      // Group sales by period
      const groupedData = {};
      sales.forEach(sale => {
        const date = new Date(sale.saleDate);
        let key;
        
        if (groupBy === 'day') {
          key = date.toISOString().split('T')[0];
        } else {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        if (!groupedData[key]) {
          groupedData[key] = 0;
        }
        groupedData[key] += parseFloat(sale.totalAmount);
      });

      res.json({
        labels: Object.keys(groupedData),
        data: Object.values(groupedData)
      });
    } catch (error) {
      next(error);
    }
  },

  // Get inventory value by category
  async getInventoryByCategory(req, res, next) {
    try {
      const products = await prisma.product.findMany({
        select: {
          category: true,
          currentStock: true,
          costPrice: true
        }
      });

      const categoryData = products.reduce((acc, product) => {
        const value = parseFloat(product.currentStock) * parseFloat(product.costPrice);
        
        if (!acc[product.category]) {
          acc[product.category] = {
            category: product.category,
            value: 0,
            items: 0
          };
        }
        
        acc[product.category].value += value;
        acc[product.category].items += 1;
        
        return acc;
      }, {});

      res.json(Object.values(categoryData));
    } catch (error) {
      next(error);
    }
  }
};
