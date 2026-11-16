const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const prisma = require('../src/config/db');
const { evaluateSubscriptionAccess } = require('../src/utils/subscriptionPolicy');

async function test() {
  const biz = await prisma.businesses.findFirst();
  const sub = await prisma.platform_subscriptions.findFirst({
    where: { business_id: biz.id },
    orderBy: { created_at: 'desc' },
    include: { subscription_plans: true }
  });
  const license = await prisma.platform_licenses.findFirst({
    where: { business_id: biz.id, status: 'ACTIVE' }
  });

  console.log('--- DB RECORD ---');
  console.log('Business name:', biz.business_name);
  console.log('Subscription status in biz table:', biz.subscription_status);
  console.log('License status in biz table:', biz.license_status);
  console.log('Self shopping status in biz table:', biz.self_shopping_status);
  console.log('Subscription record:', sub ? {
    id: sub.id,
    status: sub.status,
    plan: sub.subscription_plans?.plan_name,
    amount: sub.amount,
    trial_start_at: sub.trial_start_at,
    trial_end_at: sub.trial_end_at,
    current_period_end: sub.current_period_end
  } : 'No sub');

  const evalResult = evaluateSubscriptionAccess(sub, biz, license);
  console.log('\n--- EVALUATE SUBSCRIPTION ACCESS ---');
  console.log('Allowed:', evalResult.allowed);
  console.log('Status:', evalResult.status);
  console.log('Tier:', evalResult.tier);
  console.log('Days remaining:', evalResult.daysRemaining);
  console.log('Reason:', evalResult.reason);
  console.log('Features:', evalResult.features);

  await prisma.$disconnect();
}

test().catch(console.error);

