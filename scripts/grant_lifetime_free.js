const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const prisma = require('../src/config/db');

async function grantLifetimeFree() {
  const targetEmail = 'testsrini276@gmail.com';
  console.log(`🔍 Searching for account with email: ${targetEmail}...`);

  const user = await prisma.users.findFirst({
    where: { email: { equals: targetEmail, mode: 'insensitive' } },
    include: { businesses: true }
  });

  if (!user) {
    console.error(`❌ User with email ${targetEmail} not found!`);
    await prisma.$disconnect();
    return;
  }

  const business = user.businesses;
  console.log(`✅ Found user: ${user.name} (ID: ${user.id})`);
  console.log(`✅ Associated business: ${business.business_name} (ID: ${business.id}, Company ID: ${business.company_id})`);

  // 1. Update business fields to LIFETIME_ACTIVE, ACTIVE subscription and license status
  const updatedBiz = await prisma.businesses.update({
    where: { id: business.id },
    data: {
      subscription_status: 'ACTIVE',
      license_status: 'ACTIVE',
      self_shopping_status: 'LIFETIME_ACTIVE'
    }
  });
  console.log(`✅ Business updated: subscription_status=ACTIVE, license_status=ACTIVE, self_shopping_status=LIFETIME_ACTIVE`);

  // 2. Find or create the Lifetime Subscription Plan
  let lifetimePlan = await prisma.subscription_plans.findFirst({
    where: {
      OR: [
        { plan_name: { contains: 'Lifetime', mode: 'insensitive' } },
        { billing_type: 'ONE_TIME' }
      ]
    }
  });

  if (!lifetimePlan) {
    lifetimePlan = await prisma.subscription_plans.create({
      data: {
        plan_name: 'VEXA Lifetime (Complimentary)',
        billing_type: 'ONE_TIME',
        price: 59999.00,
        currency: 'INR',
        billing_cycle: 'One-Time Lifetime',
        description: 'Lifetime software entitlement with all features unlocked.',
        is_active: true
      }
    });
    console.log(`✅ Created Lifetime Subscription Plan: ${lifetimePlan.id}`);
  } else {
    console.log(`✅ Using Lifetime Subscription Plan: ${lifetimePlan.plan_name} (${lifetimePlan.id})`);
  }

  // 3. Upsert / Create platform_licenses record with ONE_TIME_LICENSE and ACTIVE status
  const existingLicense = await prisma.platform_licenses.findFirst({
    where: {
      business_id: business.id,
      license_type: 'ONE_TIME_LICENSE'
    }
  });

  if (existingLicense) {
    await prisma.platform_licenses.update({
      where: { id: existingLicense.id },
      data: {
        status: 'ACTIVE',
        duration_type: 'LIFETIME',
        expiry_date: null,
        plan_id: lifetimePlan.id,
        last_verified_at: new Date()
      }
    });
    console.log(`✅ Updated existing Lifetime License record: ${existingLicense.id}`);
  } else {
    const newLicense = await prisma.platform_licenses.create({
      data: {
        license_key: `LIC-VEXA-LIFETIME-${business.company_id || Date.now()}`,
        company_id: business.company_id || `CMP-${Date.now()}`,
        business_id: business.id,
        license_type: 'ONE_TIME_LICENSE',
        plan_id: lifetimePlan.id,
        status: 'ACTIVE',
        duration_type: 'LIFETIME',
        activated_at: new Date(),
        expiry_date: null,
        last_verified_at: new Date()
      }
    });
    console.log(`✅ Created new Lifetime License record: ${newLicense.id} (Key: ${newLicense.license_key})`);
  }

  // 4. Upsert / Ensure an ACTIVE platform_subscriptions record with lifetime validity
  const existingSub = await prisma.platform_subscriptions.findFirst({
    where: { business_id: business.id },
    orderBy: { created_at: 'desc' }
  });

  const farFutureDate = new Date('2099-12-31T23:59:59.000Z');

  if (existingSub) {
    await prisma.platform_subscriptions.update({
      where: { id: existingSub.id },
      data: {
        plan_id: lifetimePlan.id,
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
    console.log(`✅ Updated platform subscription: ${existingSub.id} with status=ACTIVE & Lifetime period.`);
  } else {
    const newSub = await prisma.platform_subscriptions.create({
      data: {
        company_id: business.company_id || `CMP-${Date.now()}`,
        business_id: business.id,
        plan_id: lifetimePlan.id,
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
    console.log(`✅ Created new platform subscription: ${newSub.id} with Lifetime period.`);
  }

  console.log(`\n🎉 SUCCESS! testsrini276@gmail.com has been granted permanent lifetime free access to all VEXA Invoice features!`);
  await prisma.$disconnect();
}

grantLifetimeFree().catch((err) => {
  console.error('Error granting lifetime free access:', err);
  process.exit(1);
});

