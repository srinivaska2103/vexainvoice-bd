const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

// Handle BigInt serialization in JSON responses
BigInt.prototype.toJSON = function () {
  return Number(this);
};

const authRoutes = require('./routes/auth.routes');
const masterRoutes = require('./routes/master.routes');
const productRoutes = require('./routes/product.routes');
const customerRoutes = require('./routes/customer.routes');
const supplierRoutes = require('./routes/supplier.routes');
const saleRoutes = require('./routes/sale.routes');
const purchaseRoutes = require('./routes/purchase.routes');
const stockRoutes = require('./routes/stock.routes');
const paymentRoutes = require('./routes/payment.routes');
const quotationRoutes = require('./routes/quotation.routes');
const reportRoutes = require('./routes/report.routes');
const healthRoutes = require('./routes/health.routes');
const emailRoutes = require('./routes/email.routes');
const userRoutes = require('./routes/user.routes');
const exportRoutes = require('./routes/export.routes');
const backupRoutes = require('./routes/backup.routes');
const whatsappRoutes = require('./routes/whatsapp.routes');
const crmRoutes = require('./routes/crm.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const webhookRoutes = require('./routes/webhook.routes');
const roleRoutes = require('./routes/role.routes');
const superAdminRoutes = require('./routes/superAdmin.routes');
const shopRoutes = require('./routes/shop.routes');
const customerOrderRoutes = require('./routes/customerOrder.routes');
const portalRoutes = require('./routes/portal.routes');
const supportRoutes = require('./routes/support.routes');
const salesEnquiryRoutes = require('./routes/salesEnquiry.routes');
const { seedAdminAndPlans } = require('./utils/seedAdmin.util');
const { seedHelpCenterAndFaqs } = require('./utils/seedHelpCenter.util');

// Auto-seed VEXA Admin & Plans on startup
seedAdminAndPlans();
seedHelpCenterAndFaqs();

const app = express();

// Security Middleware (Configure helmet to allow swagger UI inline styles & scripts)
app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));
app.use(express.urlencoded({ extended: true }));

// Request & Response Logging Middleware for Terminal Console
app.use((req, res, next) => {
  const startTime = Date.now();
  const timestamp = new Date().toLocaleTimeString();

  const methodBadges = {
    GET: '🔵 [GET]',
    POST: '🟢 [POST]',
    PUT: '🟡 [PUT]',
    DELETE: '🔴 [DELETE]',
    PATCH: '🟣 [PATCH]'
  };

  const badge = methodBadges[req.method] || `⚪ [${req.method}]`;

  console.log(`\n======================================================`);
  console.log(`📥 ${badge} REQUEST | ${timestamp} | ${req.originalUrl}`);

  if (Object.keys(req.query).length > 0) {
    console.log(`   Query Params:`, JSON.stringify(req.query));
  }

  if (req.body && Object.keys(req.body).length > 0) {
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.password) sanitizedBody.password = '••••••••';
    if (sanitizedBody.confirm_password) sanitizedBody.confirm_password = '••••••••';
    console.log(`   Body Payload:`, JSON.stringify(sanitizedBody));
  }

  const originalSend = res.send;
  res.send = function (body) {
    const duration = Date.now() - startTime;
    const statusIcon = res.statusCode < 400 ? '✅' : '❌';
    console.log(`📤 ${statusIcon} ${badge} RESPONSE | Status: ${res.statusCode} | Time: ${duration}ms`);
    console.log(`======================================================`);
    return originalSend.apply(res, arguments);
  };

  next();
});

app.use('/api', apiLimiter);

// Optional Swagger Interactive API Documentation UI
try {
  const swaggerUi = require('swagger-ui-express');
  const swaggerSpec = require('./config/swagger');
  if (swaggerUi && swaggerSpec) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'VEXA Invoice API Documentation Engine',
      customCss: '.swagger-ui .topbar { background-color: #1e1e2d; } .swagger-ui .topbar a span { font-weight: bold; color: #4099ff; }'
    }));
  }
} catch (e) {
  console.log('[SWAGGER] Swagger UI omitted in production environment');
}

app.use('/docs', (req, res) => res.redirect('/api-docs'));

const { renderApiPortalHtml } = require('./utils/apiPortal.html');

// Root API Portal Route (Modern Interactive UI for localhost:5000)
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(renderApiPortalHtml());
});

app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'VEXA Invoice API Base Endpoint',
    version: '1.0.0',
    documentation: '/api-docs',
    health: '/api/health'
  });
});

// API Routers
app.use('/api/health', healthRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/sales-enquiry', salesEnquiryRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/customer-orders', customerOrderRoutes);
app.use('/api', masterRoutes); // /categories, /brands, /colors, /sizes
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/support', supportRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API route '${req.originalUrl}' not found.`
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
