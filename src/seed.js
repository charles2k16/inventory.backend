import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import xlsx from 'xlsx';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create default admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@diaso.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN'
    }
  });
  console.log('✅ Admin user created');

  // Sample products from your data
  const products = [
    { itemName: 'Ceiling rubber', currentStock: 48, sellingPrice: 5, costPrice: 5, category: 'Equipment' },
    { itemName: 'TMB Bearing', currentStock: 16, sellingPrice: 100, costPrice: 100, category: 'Equipment' },
    { itemName: 'BALANCE BEARING', currentStock: 174, sellingPrice: 20, costPrice: 20, category: 'Equipment' },
    { itemName: 'TORCH BIG', currentStock: 20, sellingPrice: 180, costPrice: 180, category: 'Equipment' },
    { itemName: 'CENTRE GEAR', currentStock: 16, sellingPrice: 120, costPrice: 120, category: 'Equipment' },
    { itemName: 'KEY CUP', currentStock: 66, sellingPrice: 100, costPrice: 100, category: 'Equipment' },
    { itemName: 'LINING TYRE', currentStock: 258, sellingPrice: 5, costPrice: 5, category: 'Equipment' },
    { itemName: 'KEY CUP GASKET', currentStock: 100, sellingPrice: 5, costPrice: 5, category: 'Equipment' },
    { itemName: 'EPOXY', currentStock: 10, sellingPrice: 20, costPrice: 20, category: 'Equipment' },
    { itemName: 'SILICON', currentStock: 38, sellingPrice: 30, costPrice: 30, category: 'Equipment' },
    { itemName: 'GREASE', currentStock: 857, sellingPrice: 35, costPrice: 35, category: 'Equipment' },
    { itemName: 'SPANNERS', currentStock: 770, sellingPrice: 15, costPrice: 15, category: 'Tools' },
    { itemName: 'COMPLETE LINING', currentStock: 239, sellingPrice: 370, costPrice: 370, category: 'Equipment' },
    { itemName: 'HAMMERS', currentStock: 186, sellingPrice: 300, costPrice: 300, category: 'Tools' },
    { itemName: 'PUMPING MACHINE', currentStock: 22, sellingPrice: 2800, costPrice: 2800, category: 'Equipment' },
    { itemName: 'SHOVEL GREEN', currentStock: 48, sellingPrice: 100, costPrice: 100, category: 'Tools' },
    { itemName: 'CRUSHER', currentStock: 17, sellingPrice: 4000, costPrice: 4000, category: 'Equipment' },
    { itemName: 'WOOLEN', currentStock: 757, sellingPrice: 70, costPrice: 70, category: 'Equipment' },
    { itemName: 'BLANKET RED', currentStock: 95, sellingPrice: 50, costPrice: 50, category: 'Equipment' },
    { itemName: 'TYRE', currentStock: 52, sellingPrice: 100, costPrice: 100, category: 'Equipment' }
  ];

  for (const productData of products) {
    await prisma.product.create({
      data: {
        ...productData,
        barcodeNumber: `BAR-${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        itemDescription: 'Product',
        type: 'Product',
        units: 'Product',
        locationName: 'Diaso',
        reorderLevel: 10
      }
    });
  }
  console.log(`✅ ${products.length} products created`);

  // Create sample lenders
  const lenders = [
    { name: 'John Mensah', phone: '+233241234567', creditLimit: 5000 },
    { name: 'Grace Osei', phone: '+233207654321', creditLimit: 3000 },
    { name: 'Kwame Asante', phone: '+233551234567', creditLimit: 10000 }
  ];

  for (const lenderData of lenders) {
    await prisma.lender.create({
      data: {
        ...lenderData,
        customerCode: `CUST-${String(Math.floor(Math.random() * 99999) + 1).padStart(5, '0')}`,
        email: `${lenderData.name.toLowerCase().replace(' ', '.')}@example.com`
      }
    });
  }
  console.log(`✅ ${lenders.length} lenders created`);

  // Create current week report
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const allProducts = await prisma.product.findMany({
    select: { id: true, currentStock: true, costPrice: true }
  });

  const openingStock = {};
  let totalValue = 0;

  allProducts.forEach(product => {
    openingStock[product.id] = product.currentStock;
    totalValue += parseFloat(product.currentStock) * parseFloat(product.costPrice);
  });

  const weekNumber = Math.ceil(now.getDate() / 7);
  
  await prisma.weeklyStockReport.create({
    data: {
      weekNumber,
      year: now.getFullYear(),
      startDate: startOfWeek,
      endDate: endOfWeek,
      openingStock,
      closingStock: {},
      totalValue
    }
  });
  console.log('✅ Current week report created');

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
