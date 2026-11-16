const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { ensureCompanyIdsForExistingBusinesses } = require('./companyId.util');

const seedAdminAndPlans = async () => {
  try {
    // 1. Backfill company_id for existing businesses
    await ensureCompanyIdsForExistingBusinesses();

    // 2. Ensure default Super Admin user exists
    const adminEmail = 'vexatech.connect@gmail.com';
    const existingAdmin = await prisma.admin_users.findFirst({
      where: { OR: [{ email: adminEmail }, { email: 'admin@vexatech.in' }] }
    });

    if (!existingAdmin) {
      const password_hash = await bcrypt.hash('Admin@123456', 10);
      await prisma.admin_users.create({
        data: {
          name: 'VEXA TECH Super Admin',
          email: adminEmail,
          phone: '+919876543210',
          password_hash,
          role: 'SUPER_ADMIN',
          is_active: true
        }
      });
      console.log(`✅ Default VEXA Admin created: ${adminEmail} / Admin@123456`);
    } else if (existingAdmin.email !== adminEmail) {
      await prisma.admin_users.update({
        where: { id: existingAdmin.id },
        data: { email: adminEmail }
      });
      console.log(`✅ Updated VEXA Admin email to: ${adminEmail}`);
    }

    // 3. Ensure Default VEXA Invoice Monthly (Starter) Plan exists (₹599/month)
    const monthlyPlan = await prisma.subscription_plans.findFirst({
      where: {
        OR: [
          { plan_name: 'VEXA Invoice Monthly', billing_type: 'MONTHLY' },
          { plan_name: 'VEXA Starter', billing_type: 'MONTHLY' }
        ]
      }
    });

    if (!monthlyPlan) {
      await prisma.subscription_plans.create({
        data: {
          plan_name: 'VEXA Starter',
          billing_type: 'MONTHLY',
          price: 599.00,
          currency: 'INR',
          tax_percentage: 18.00,
          billing_cycle: 'Monthly',
          description: 'Core business management system: Sales POS, inventory, stock, expenses, and invoices.',
          is_active: true
        }
      });
      console.log('✅ Default VEXA Starter Monthly Plan (₹599/mo) initialized');
    } else {
      await prisma.subscription_plans.update({
        where: { id: monthlyPlan.id },
        data: {
          price: 599.00,
          currency: 'INR',
          is_active: true,
          billing_cycle: 'Monthly'
        }
      });
      console.log('✅ VEXA Starter Monthly Plan confirmed active (₹599/mo)');
    }

    // 3b. Ensure VEXA Growth Plan exists (₹999/month)
    const growthPlan = await prisma.subscription_plans.findFirst({
      where: {
        OR: [
          { plan_name: 'VEXA Growth', billing_type: 'MONTHLY' },
          { plan_name: 'VEXA Invoice Growth', billing_type: 'MONTHLY' }
        ]
      }
    });

    if (!growthPlan) {
      await prisma.subscription_plans.create({
        data: {
          plan_name: 'VEXA Growth',
          billing_type: 'MONTHLY',
          price: 999.00,
          currency: 'INR',
          tax_percentage: 18.00,
          billing_cycle: 'Monthly',
          description: 'All Starter features + Customer Self-Service Portal, Online Storefront, WhatsApp campaigns & advanced analytics.',
          is_active: true
        }
      });
      console.log('✅ Default VEXA Growth Monthly Plan (₹999/mo) initialized');
    } else {
      await prisma.subscription_plans.update({
        where: { id: growthPlan.id },
        data: {
          price: 999.00,
          currency: 'INR',
          is_active: true,
          billing_cycle: 'Monthly'
        }
      });
      console.log('✅ VEXA Growth Monthly Plan confirmed active (₹999/mo)');
    }

    // 4. Ensure VEXA Invoice Lifetime Add-on Plan exists (₹59,999 One-Time)
    const lifetimePlan = await prisma.subscription_plans.findFirst({
      where: { plan_name: 'VEXA Invoice Lifetime', billing_type: 'ONE_TIME' }
    });

    if (!lifetimePlan) {
      await prisma.subscription_plans.create({
        data: {
          plan_name: 'VEXA Invoice Lifetime',
          billing_type: 'ONE_TIME',
          price: 59999.00,
          currency: 'INR',
          tax_percentage: 18.00,
          billing_cycle: 'Lifetime',
          description: 'Lifetime access to QR Self-Shopping & Customer Orders module',
          is_active: true
        }
      });
      console.log('✅ Default VEXA Invoice Lifetime Add-on Plan (₹59,999) initialized');
    } else {
      await prisma.subscription_plans.update({
        where: { id: lifetimePlan.id },
        data: {
          price: 59999.00,
          currency: 'INR',
          is_active: true,
          billing_cycle: 'Lifetime'
        }
      });
    }
    // 5. Ensure testsrini276@gmail.com has Lifetime Free Subscription with all features enabled
    const targetEmail = 'testsrini276@gmail.com';
    const testUser = await prisma.users.findFirst({
      where: { email: { equals: targetEmail, mode: 'insensitive' } },
      include: { businesses: true }
    });

    if (testUser && testUser.businesses) {
      const biz = testUser.businesses;

      // Update business entity
      await prisma.businesses.update({
        where: { id: biz.id },
        data: {
          subscription_status: 'ACTIVE',
          license_status: 'ACTIVE',
          self_shopping_status: 'LIFETIME_ACTIVE'
        }
      });

      // Upsert platform license
      const existingLic = await prisma.platform_licenses.findFirst({
        where: {
          business_id: biz.id,
          license_type: 'ONE_TIME_LICENSE'
        }
      });

      if (existingLic) {
        await prisma.platform_licenses.update({
          where: { id: existingLic.id },
          data: {
            status: 'ACTIVE',
            duration_type: 'LIFETIME',
            expiry_date: null,
            plan_id: lifetimePlan?.id || null,
            last_verified_at: new Date()
          }
        });
      } else {
        await prisma.platform_licenses.create({
          data: {
            license_key: `LIC-VEXA-LIFETIME-${biz.company_id || Date.now()}`,
            company_id: biz.company_id || `CMP-${Date.now()}`,
            business_id: biz.id,
            license_type: 'ONE_TIME_LICENSE',
            plan_id: lifetimePlan?.id || null,
            status: 'ACTIVE',
            duration_type: 'LIFETIME',
            activated_at: new Date(),
            expiry_date: null,
            last_verified_at: new Date()
          }
        });
      }

      // Upsert platform subscription with far future validity
      const existingSub = await prisma.platform_subscriptions.findFirst({
        where: { business_id: biz.id },
        orderBy: { created_at: 'desc' }
      });

      const farFutureDate = new Date('2099-12-31T23:59:59.000Z');

      if (existingSub) {
        await prisma.platform_subscriptions.update({
          where: { id: existingSub.id },
          data: {
            plan_id: lifetimePlan?.id || null,
            status: 'ACTIVE',
            amount: 59999.00,
            billing_interval: 'LIFETIME',
            current_period_start: new Date(),
            current_period_end: farFutureDate,
            next_billing_date: null,
            auto_renew: false,
            cancel_at_period_end: false,
            last_successful_payment: new Date()
          }
        });
      } else {
        await prisma.platform_subscriptions.create({
          data: {
            company_id: biz.company_id || `CMP-${Date.now()}`,
            business_id: biz.id,
            plan_id: lifetimePlan?.id || null,
            provider: 'OFFLINE_GRANT',
            status: 'ACTIVE',
            amount: 59999.00,
            currency: 'INR',
            billing_interval: 'LIFETIME',
            current_period_start: new Date(),
            current_period_end: farFutureDate,
            next_billing_date: null,
            auto_renew: false,
            last_successful_payment: new Date()
          }
        });
      }

      console.log(`🎉 [LIFETIME GRANT] Successfully configured permanent lifetime free subscription for ${targetEmail} (Business: ${biz.business_name})!`);
    } else {
      console.log(`ℹ️ [LIFETIME GRANT] Account ${targetEmail} not found in users table yet (will apply when created).`);
    }
  } catch (err) {
    console.error('Error seeding plans:', err.message);
  }
};

module.exports = { seedAdminAndPlans };
