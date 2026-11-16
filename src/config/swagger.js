const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'VEXA Invoice API Engine',
      version: '1.0.0',
      description: 'Production-ready Business Management & Billing System API Engine for Retail, Wholesale, Garment, and Textile Enterprises.',
      contact: {
        name: 'VEXA Tech Support',
        email: 'support@vexainvoice.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Local Development Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token obtained from `/api/auth/login` or `/api/auth/register`'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      { name: 'Health', description: 'System health check' },
      { name: 'Authentication', description: 'Business registration, login & user profile' },
      { name: 'Master Data', description: 'Categories, Brands, Colors, Sizes & Tax rates' },
      { name: 'Products & Variants', description: 'Products, SKUs, Barcodes & Garment Stock Matrix' },
      { name: 'Customers', description: 'Customer profiles, Ledger & Outstanding' },
      { name: 'Suppliers', description: 'Supplier profiles & Supplier Ledger' },
      { name: 'Sales & Invoicing', description: 'Invoice creation, POS billing & Sales returns' },
      { name: 'Purchases', description: 'Inward purchase bills & vendor returns' },
      { name: 'Stock & Inventory', description: 'Stock balances, low stock alerts & adjustments' },
      { name: 'Payments', description: 'Customer receivables & supplier payables' },
      { name: 'Quotations', description: 'Price estimates & 1-click convert-to-sale' },
      { name: 'Reports & Dashboard', description: 'Real-time financial metrics, GSTR-1, P&L' }
    ],
    paths: {
      '/api/health': {
        get: {
          tags: ['Health'],
          summary: 'Health Check API',
          description: 'Returns API status and database connectivity indicator.',
          responses: { 200: { description: 'API is operational' } }
        }
      },
      '/api/auth/register': {
        post: {
          tags: ['Authentication'],
          summary: 'Register Business & Admin User',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['business_name', 'business_type', 'email', 'admin_name', 'password'],
                  properties: {
                    business_name: { type: 'string', example: 'VEXA Garments' },
                    business_type: { type: 'string', example: 'GARMENT_TEXTILE' },
                    owner_name: { type: 'string', example: 'Srinivas' },
                    phone: { type: 'string', example: '9876543210' },
                    email: { type: 'string', example: 'admin@vexagarments.com' },
                    invoice_prefix: { type: 'string', example: 'VEX' },
                    admin_name: { type: 'string', example: 'Super Admin' },
                    password: { type: 'string', example: 'Password@123' }
                  }
                }
              }
            }
          },
          responses: { 201: { description: 'Registered' }, 409: { description: 'User exists' } }
        }
      },
      '/api/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'User Login',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', example: 'admin@vexainvoice.com' },
                    password: { type: 'string', example: 'Password@123' }
                  }
                }
              }
            }
          },
          responses: { 200: { description: 'Login successful' } }
        }
      },
      '/api/auth/me': {
        get: {
          tags: ['Authentication'],
          summary: 'Get Current User Profile & Business Details',
          responses: { 200: { description: 'Current user payload' } }
        }
      },
      // --- MASTER DATA ---
      '/api/categories': {
        get: {
          tags: ['Master Data'],
          summary: 'Get All Product Categories',
          responses: { 200: { description: 'List of categories' } }
        },
        post: {
          tags: ['Master Data'],
          summary: 'Create Product Category',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: { name: { type: 'string', example: 'Readymade Shirts' } }
                }
              }
            }
          },
          responses: { 201: { description: 'Category created' } }
        }
      },
      '/api/brands': {
        get: {
          tags: ['Master Data'],
          summary: 'Get All Brands',
          responses: { 200: { description: 'List of brands' } }
        },
        post: {
          tags: ['Master Data'],
          summary: 'Create Brand',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: { name: { type: 'string', example: 'Raymond' } }
                }
              }
            }
          },
          responses: { 201: { description: 'Brand created' } }
        }
      },
      '/api/colors': {
        get: {
          tags: ['Master Data'],
          summary: 'Get All Custom Colors',
          responses: { 200: { description: 'List of colors' } }
        },
        post: {
          tags: ['Master Data'],
          summary: 'Create Custom Color',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: { name: { type: 'string', example: 'Navy Blue' }, hex_code: { type: 'string', example: '#000080' } }
                }
              }
            }
          },
          responses: { 201: { description: 'Color created' } }
        }
      },
      '/api/sizes': {
        get: {
          tags: ['Master Data'],
          summary: 'Get All Custom Sizes',
          responses: { 200: { description: 'List of sizes' } }
        },
        post: {
          tags: ['Master Data'],
          summary: 'Create Custom Size',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: { name: { type: 'string', example: 'XL' }, sort_order: { type: 'number', example: 4 } }
                }
              }
            }
          },
          responses: { 201: { description: 'Size created' } }
        }
      },
      '/api/tax-rates': {
        get: {
          tags: ['Master Data'],
          summary: 'Get GST Tax Rates List',
          responses: { 200: { description: 'GST rate options (0%, 5%, 12%, 18%, 28%)' } }
        }
      },
      // --- PRODUCTS ---
      '/api/products': {
        get: {
          tags: ['Products & Variants'],
          summary: 'Get Paginated Products List',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
            { name: 'search', in: 'query', schema: { type: 'string' } }
          ],
          responses: { 200: { description: 'List of products' } }
        },
        post: {
          tags: ['Products & Variants'],
          summary: 'Create Product Catalog Entry',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string', example: 'Cotton Formal Shirt' },
                    sku: { type: 'string', example: 'SHIRT-101' },
                    barcode: { type: 'string', example: '89012345678' },
                    retail_price: { type: 'number', example: 1200 },
                    wholesale_price: { type: 'number', example: 950 },
                    purchase_price: { type: 'number', example: 700 },
                    opening_stock: { type: 'number', example: 50 },
                    unit: { type: 'string', example: 'PCS' }
                  }
                }
              }
            }
          },
          responses: { 201: { description: 'Product created' } }
        }
      },
      '/api/products/{id}': {
        get: {
          tags: ['Products & Variants'],
          summary: 'Get Product Details by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Product details' } }
        },
        put: {
          tags: ['Products & Variants'],
          summary: 'Update Product',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', example: 'Cotton Formal Shirt - Premium' },
                    retail_price: { type: 'number', example: 1250 }
                  }
                }
              }
            }
          },
          responses: { 200: { description: 'Product updated' } }
        },
        delete: {
          tags: ['Products & Variants'],
          summary: 'Deactivate Product',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Product deactivated' } }
        }
      },
      // --- CUSTOMERS ---
      '/api/customers': {
        get: {
          tags: ['Customers'],
          summary: 'Get All Customer Accounts',
          parameters: [{ name: 'search', in: 'query', schema: { type: 'string' } }],
          responses: { 200: { description: 'List of customers' } }
        },
        post: {
          tags: ['Customers'],
          summary: 'Create Customer Account',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string', example: 'Royal Garments Store' },
                    customer_type: { type: 'string', example: 'WHOLESALE' },
                    phone: { type: 'string', example: '9876543210' },
                    gstin: { type: 'string', example: '33AAAAA0000A1Z5' }
                  }
                }
              }
            }
          },
          responses: { 201: { description: 'Customer created' } }
        }
      },
      '/api/customers/{id}/ledger': {
        get: {
          tags: ['Customers'],
          summary: 'Get Customer Party Ledger Account Statement',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Running balance debit/credit log' } }
        }
      },
      // --- SUPPLIERS ---
      '/api/suppliers': {
        get: {
          tags: ['Suppliers'],
          summary: 'Get All Suppliers / Manufacturers',
          parameters: [{ name: 'search', in: 'query', schema: { type: 'string' } }],
          responses: { 200: { description: 'List of vendors' } }
        },
        post: {
          tags: ['Suppliers'],
          summary: 'Add New Supplier Vendor',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string', example: 'Tirupur Knitting Mills' },
                    phone: { type: 'string', example: '9842100000' },
                    city: { type: 'string', example: 'Tirupur' }
                  }
                }
              }
            }
          },
          responses: { 201: { description: 'Supplier created' } }
        }
      },
      '/api/suppliers/{id}/ledger': {
        get: {
          tags: ['Suppliers'],
          summary: 'Get Supplier Statement Ledger',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Supplier payable transactions' } }
        }
      },
      // --- SALES ---
      '/api/sales': {
        get: {
          tags: ['Sales & Invoicing'],
          summary: 'Get All Sales Invoices',
          parameters: [
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'invoiceType', in: 'query', schema: { type: 'string' } }
          ],
          responses: { 200: { description: 'List of invoices' } }
        },
        post: {
          tags: ['Sales & Invoicing'],
          summary: 'Create Confirmed Sale Invoice (POS / Wholesale)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['items'],
                  properties: {
                    invoiceType: { type: 'string', example: 'RETAIL' },
                    paymentMethod: { type: 'string', example: 'CASH' },
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['productId', 'quantity'],
                        properties: {
                          productId: { type: 'string' },
                          quantity: { type: 'number', example: 1 },
                          unitPrice: { type: 'number', example: 1200 }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          responses: { 201: { description: 'Sale invoice completed & stock deducted' } }
        }
      },
      '/api/sales/{id}': {
        get: {
          tags: ['Sales & Invoicing'],
          summary: 'Get Sale Invoice Details by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Full invoice details' } }
        }
      },
      '/api/returns/sales': {
        get: {
          tags: ['Sales & Invoicing'],
          summary: 'Get Sales Returns & Credit Notes List',
          responses: { 200: { description: 'List of sales returns' } }
        },
        post: {
          tags: ['Sales & Invoicing'],
          summary: 'Process Customer Sales Return',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['saleId'],
                  properties: {
                    saleId: { type: 'string' },
                    reason: { type: 'string', example: 'Fitting issue' },
                    refundAmount: { type: 'number', example: 1200 }
                  }
                }
              }
            }
          },
          responses: { 201: { description: 'Sales return completed' } }
        }
      },
      // --- PURCHASES ---
      '/api/purchases': {
        get: {
          tags: ['Purchases'],
          summary: 'Get All Inward Purchase Bills',
          responses: { 200: { description: 'List of purchase bills' } }
        },
        post: {
          tags: ['Purchases'],
          summary: 'Record New Inward Purchase Entry',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['supplierId', 'items'],
                  properties: {
                    supplierId: { type: 'string' },
                    supplierInvoiceNumber: { type: 'string', example: 'INV-2024-889' },
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          productId: { type: 'string' },
                          quantity: { type: 'number', example: 50 },
                          unitCost: { type: 'number', example: 700 }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          responses: { 201: { description: 'Purchase recorded & inventory stock added' } }
        }
      },
      // --- STOCK ---
      '/api/stock/balances': {
        get: {
          tags: ['Stock & Inventory'],
          summary: 'Get Real-Time Product Stock Counts',
          parameters: [{ name: 'search', in: 'query', schema: { type: 'string' } }],
          responses: { 200: { description: 'Current stock per product' } }
        }
      },
      '/api/stock/adjustments': {
        get: {
          tags: ['Stock & Inventory'],
          summary: 'Get Stock Adjustment Logs',
          responses: { 200: { description: 'Log of stock changes' } }
        },
        post: {
          tags: ['Stock & Inventory'],
          summary: 'Create Manual Stock Adjustment',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['productId', 'quantity', 'reason'],
                  properties: {
                    productId: { type: 'string' },
                    quantity: { type: 'number', example: -2 },
                    reason: { type: 'string', example: 'Damaged in shop transit' }
                  }
                }
              }
            }
          },
          responses: { 201: { description: 'Stock adjusted' } }
        }
      },
      // --- PAYMENTS ---
      '/api/payments/customers': {
        get: {
          tags: ['Payments'],
          summary: 'Get Customer Direct Payment Log',
          responses: { 200: { description: 'List of customer payments' } }
        },
        post: {
          tags: ['Payments'],
          summary: 'Record Direct Customer Payment',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['customer_id', 'amount'],
                  properties: {
                    customer_id: { type: 'string' },
                    sale_id: { type: 'string' },
                    amount: { type: 'number', example: 5000 },
                    payment_method: { type: 'string', example: 'UPI' }
                  }
                }
              }
            }
          },
          responses: { 201: { description: 'Payment recorded' } }
        }
      },
      '/api/payments/suppliers': {
        get: {
          tags: ['Payments'],
          summary: 'Get Supplier Payment Log',
          responses: { 200: { description: 'List of supplier payments' } }
        },
        post: {
          tags: ['Payments'],
          summary: 'Record Supplier Vendor Payment',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['supplier_id', 'amount'],
                  properties: {
                    supplier_id: { type: 'string' },
                    amount: { type: 'number', example: 10000 },
                    payment_method: { type: 'string', example: 'BANK_TRANSFER' }
                  }
                }
              }
            }
          },
          responses: { 201: { description: 'Supplier payment recorded' } }
        }
      },
      // --- QUOTATIONS ---
      '/api/quotations': {
        get: {
          tags: ['Quotations'],
          summary: 'Get All Price Quotations & Estimates',
          responses: { 200: { description: 'List of quotations' } }
        },
        post: {
          tags: ['Quotations'],
          summary: 'Create New Quotation / Estimate',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['items'],
                  properties: {
                    customerId: { type: 'string' },
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          productId: { type: 'string' },
                          quantity: { type: 'number', example: 10 },
                          unitPrice: { type: 'number', example: 600 }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          responses: { 201: { description: 'Quotation created' } }
        }
      },
      '/api/quotations/{id}/convert-to-sale': {
        post: {
          tags: ['Quotations'],
          summary: 'Convert Quotation to Confirmed Sales Invoice',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Quotation converted to sale invoice' } }
        }
      },
      // --- REPORTS ---
      '/api/reports/dashboard': {
        get: {
          tags: ['Reports & Dashboard'],
          summary: 'Get Real-Time Executive Dashboard Summary KPIs',
          responses: { 200: { description: 'Today sales, collections, stock valuation, low stock alerts' } }
        }
      },
      '/api/reports/sales': {
        get: {
          tags: ['Reports & Dashboard'],
          summary: 'Get Detailed Sales Turnover Report',
          responses: { 200: { description: 'Sales report summary' } }
        }
      },
      '/api/reports/gst': {
        get: {
          tags: ['Reports & Dashboard'],
          summary: 'Get GSTR-1 GST Tax Liability Summary Report',
          responses: { 200: { description: 'Taxable value, CGST, SGST, IGST total' } }
        }
      },
      '/api/reports/inventory': {
        get: {
          tags: ['Reports & Dashboard'],
          summary: 'Get Inventory Stock Valuation & Retail Potential Report',
          responses: { 200: { description: 'Stock cost value and retail profit potential' } }
        }
      },
      '/api/reports/profit-loss': {
        get: {
          tags: ['Reports & Dashboard'],
          summary: 'Get Profit & Loss Financial Statement',
          responses: { 200: { description: 'Turnover, COGS, Net Gross Margin' } }
        }
      }
    }
  },
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
