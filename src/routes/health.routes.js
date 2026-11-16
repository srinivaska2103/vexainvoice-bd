const express = require('express');
const router = express.Router();
const prisma = require('../config/db');

const env = require('../config/env');

router.get('/', async (req, res) => {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;

    return res.status(200).json({
      success: true,
      status: 'healthy',
      serverRole: env.SERVER_ROLE,
      workersEnabled: env.RUN_BACKGROUND_WORKERS && (env.SERVER_ROLE === 'all' || env.SERVER_ROLE === 'worker'),
      database: {
        connected: true,
        latencyMs,
        maxPoolConnections: env.DB_CONNECTION_LIMIT
      },
      assignedCompany: env.ASSIGNED_COMPANY_ID ? 'PINNED' : 'MULTI_TENANT',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Health check DB failed:', err.message);
    return res.status(500).json({
      success: false,
      status: 'unhealthy',
      message: 'Database connection error',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;

