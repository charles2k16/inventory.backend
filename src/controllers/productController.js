import { PrismaClient } from '@prisma/client';
import XLSX from 'xlsx';
import fs from 'fs';

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
  // Bulk import from JSON or file
  async bulkImport(req, res, next) {
    try {
      let products = [];

      // If file is uploaded
      if (req.file) {
        const filePath = req.file.path;
        const fileExt = req.file.originalname.split('.').pop().toLowerCase();

        try {
          if (fileExt === 'csv') {
            // Parse CSV file
            products = parseCSV(filePath);
          } else if (['xlsx', 'xls'].includes(fileExt)) {
            // Parse Excel file
            products = parseExcel(filePath);
          } else {
            return res.status(400).json({
              error: 'Invalid file format. Please upload CSV or Excel file',
            });
          }

          // Clean up temp file
          fs.unlinkSync(filePath);
        } catch (parseError) {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          return res.status(400).json({
            error: 'Failed to parse file: ' + parseError.message,
          });
        }
      } else if (req.body.products) {
        // If products sent as JSON
        products = req.body.products;
      } else {
        return res.status(400).json({
          error: 'No file or products data provided',
        });
      }

      // Validate and clean product data
      const cleanedProducts = products
        .map((product, idx) => {
          const itemName = product.itemName || product['Item Name'] || '';
          const sellingPrice = parseFloat(
            product.sellingPrice || product['Selling Price'] || 0,
          );
          const costPrice = parseFloat(product.costPrice || product['Cost Price'] || 0);
          const currentStock = parseInt(
            product.currentStock || product['Current Stock'] || 0,
          );

          // Validation: require itemName and sellingPrice
          if (!itemName || itemName.trim() === '') {
            console.warn(`Row ${idx + 2}: Missing item name, skipping`);
            return null;
          }
          if (!sellingPrice || isNaN(sellingPrice) || sellingPrice <= 0) {
            console.warn(
              `Row ${idx + 2}: Missing or invalid selling price for "${itemName}", skipping`,
            );
            return null;
          }

          return {
            itemName: itemName.trim(),
            itemDescription: product.itemDescription || product['Item Description'] || '',
            category: product.category || product['Category'] || 'Equipment',
            barcodeNumber: product.barcodeNumber || product['Barcode'] || '',
            costPrice: isNaN(costPrice) || costPrice < 0 ? 0 : costPrice,
            sellingPrice: sellingPrice,
            currentStock: isNaN(currentStock) || currentStock < 0 ? 0 : currentStock,
            reorderLevel: parseInt(
              product.reorderLevel || product['Reorder Level'] || 10,
            ),
            type: 'Product',
            units: 'Product',
            locationName: 'Diaso',
          };
        })
        .filter(p => p !== null); // Filter out invalid rows

      if (cleanedProducts.length === 0) {
        return res.status(400).json({
          error:
            'No valid products found in the file. Ensure each product has a name and selling price.',
        });
      }

      const result = await prisma.product.createMany({
        data: cleanedProducts,
        skipDuplicates: true,
      });

      res.status(201).json({
        message: `${result.count} products imported successfully`,
        count: result.count,
        total: cleanedProducts.length,
        skipped: cleanedProducts.length - result.count,
      });
    } catch (error) {
      next(error);
    }
  },

  // Get import template
  async getImportTemplate(req, res, next) {
    try {
      const template = [
        {
          'Item Name': 'Hammer',
          'Item Description': 'Steel hammer tool',
          Category: 'Tools',
          Barcode: 'BAR001',
          'Cost Price': 50,
          'Selling Price': 75,
          'Current Stock': 10,
          'Reorder Level': 5,
        },
        {
          'Item Name': 'Saw',
          'Item Description': 'Hand saw',
          Category: 'Tools',
          Barcode: 'BAR002',
          'Cost Price': 100,
          'Selling Price': 150,
          'Current Stock': 5,
          'Reorder Level': 3,
        },
      ];

      // Create Excel workbook
      const ws = XLSX.utils.json_to_sheet(template);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Products');

      // Set column widths
      ws['!cols'] = [
        { wch: 20 },
        { wch: 30 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 },
      ];

      // Generate buffer
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

      res.setHeader(
        'Content-Disposition',
        'attachment; filename="product_import_template.xlsx"',
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.send(buf);
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

// Helper function to parse CSV file
function parseCSV(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const lines = fileContent.trim().split('\n');

  if (lines.length < 2) {
    throw new Error('CSV file is empty');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const products = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const product = {};

    headers.forEach((header, index) => {
      product[header] = values[index] || '';
    });

    if (product[headers[0]]) {
      // Only add if first column (name) has value
      products.push(product);
    }
  }

  return products;
}

// Helper function to parse Excel file
function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const products = XLSX.utils.sheet_to_json(worksheet);

  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('No data found in Excel file');
  }

  return products;
}
