const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const prisma = require('../src/config/db');

async function check() {
  const businesses = await prisma.businesses.findMany({
    select: { id: true, business_name: true, email: true, phone: true }
  });
  console.log('Businesses:', businesses);
  const wallets = await prisma.whatsapp_wallets.findMany();
  console.log('Wallets:', wallets);
  const rates = await prisma.whatsapp_rate_configs.findMany();
  console.log('Rate configs:', rates);
  const messages = await prisma.whatsapp_messages.findMany({ take: 5 });
  console.log('Sample messages:', messages);
  await prisma.$disconnect();
}

check().catch(console.error);

