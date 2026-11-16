const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const subService = require('../src/services/subscription.service');
const prisma = require('../src/config/db');

async function testSub() {
  const biz = await prisma.businesses.findFirst();
  const res = await subService.getCompanySubscriptionStatus(biz.id);
  console.log('company in getCompanySubscriptionStatus:', res.company);
  console.log('access_policy:', res.access_policy);
  await prisma.$disconnect();
}
testSub().catch(console.error);









