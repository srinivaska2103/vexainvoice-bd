const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/db');

let PORT = parseInt(env.PORT || 5000, 10);
let activeTimers = [];

const startServer = (portToUse) => {
  const server = app.listen(portToUse, '0.0.0.0', async () => {
    console.log(`🚀 VEXA Invoice Backend Server running on port ${portToUse} in ${env.NODE_ENV} mode [Role: ${env.SERVER_ROLE}]`);
    try {
      await prisma.$connect();
      console.log(`✅ PostgreSQL database connection active (bounded pool: ${env.DB_CONNECTION_LIMIT} max)`);

      // Multi-Server Coordination: Only start background schedulers if this server instance is configured to run workers
      const shouldRunWorkers = env.RUN_BACKGROUND_WORKERS && (env.SERVER_ROLE === 'all' || env.SERVER_ROLE === 'worker');

      if (shouldRunWorkers) {
        console.log('⚙️ Background worker schedulers enabled for this server instance');
        const { initAutoDailyBackupScheduler } = require('./services/backup.service');
        initAutoDailyBackupScheduler();

        // Subscription upcoming renewal reminder scanner (runs every 6 hours)
        const subService = require('./services/subscription.service');
        if (typeof subService.processUpcomingRenewalReminders === 'function') {
          const renewalTimer = setInterval(() => {
            subService.processUpcomingRenewalReminders().catch(err => console.error('Upcoming renewal reminder error:', err.message));
          }, 6 * 60 * 60 * 1000);
          activeTimers.push(renewalTimer);
        }

        // 7-Day Free Trial reminder & expiry scanner (runs on startup, then every 30 minutes)
        if (typeof subService.processTrialRemindersAndExpirations === 'function') {
          subService.processTrialRemindersAndExpirations().catch(err => console.error('Trial scanner error on startup:', err.message));
          const trialTimer = setInterval(() => {
            subService.processTrialRemindersAndExpirations().catch(err => console.error('Trial scanner error:', err.message));
          }, 30 * 60 * 1000);
          activeTimers.push(trialTimer);
        }

        // WhatsApp Automated Utility Reminders: Subscription Expiry & Payment Overdue (runs every 1 hour)
        const WhatsAppTemplateService = require('./services/whatsappTemplateService');
        // Initial scan on worker startup
        WhatsAppTemplateService.scanAndSendSubscriptionReminders().catch(err => console.error('WhatsApp sub reminder error on startup:', err.message));
        WhatsAppTemplateService.scanAndSendOverdueReminders().catch(err => console.error('WhatsApp overdue reminder error on startup:', err.message));

        const whatsappScannerTimer = setInterval(() => {
          WhatsAppTemplateService.scanAndSendSubscriptionReminders().catch(err => console.error('WhatsApp sub reminder interval error:', err.message));
          WhatsAppTemplateService.scanAndSendOverdueReminders().catch(err => console.error('WhatsApp overdue reminder interval error:', err.message));
        }, 60 * 60 * 1000);
        activeTimers.push(whatsappScannerTimer);
      } else {
        console.log('ℹ️ Background worker schedulers disabled on this dedicated web application server.');
      }
    } catch (err) {
      console.error('❌ Failed to connect to PostgreSQL database:', err.message);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${portToUse} is already in use by an active process.`);
    } else {
      console.error('❌ Server error:', err);
    }
  });

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    activeTimers.forEach(t => clearInterval(t));
    server.close(async () => {
      console.log('🔌 Closed HTTP server listeners.');
      try {
        await prisma.$disconnect();
        console.log('📦 Closed Prisma PostgreSQL connections cleanly.');
      } catch (e) {
        console.error('Error disconnecting Prisma client:', e.message);
      }
      process.exit(0);
    });

    // Force exit after 10 seconds if hanging
    setTimeout(() => {
      console.error('⚠️ Forcing process exit after shutdown timeout');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
};

const server = startServer(PORT);

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});

module.exports = server;
