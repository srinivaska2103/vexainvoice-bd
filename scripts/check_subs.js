const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const prisma = require('../src/config/db');

async function checkAllSubs() {
  const biz = await prisma.businesses.findFirst();
  const subs = await prisma.platform_subscriptions.findMany({
    where: { business_id: biz.id },
    orderBy: { created_at: 'desc' }
  });
  console.log('ALL SUBSCRIPTIONS FOR ASVA:');
  subs.forEach(s => console.log(s.id, s.status, s.amount, s.created_at, s.current_period_end));
  await prisma.$disconnect();
}
checkAllSubs();

