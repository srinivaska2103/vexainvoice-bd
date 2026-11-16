const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');

const token = process.env.WHATSAPP_ACCESS_TOKEN;
const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

console.log('Querying WABA:', wabaId);

axios.get(`https://graph.facebook.com/v20.0/${wabaId}/message_templates`, {
  headers: { Authorization: `Bearer ${token}` },
  params: { limit: 100 }
}).then(res => {
  console.log('=== APPROVED / FOUND TEMPLATES ===');
  res.data.data.forEach(t => {
    console.log(`\nTemplate: ${t.name} | Status: ${t.status} | Category: ${t.category} | Lang: ${t.language}`);
    t.components.forEach(c => {
      console.log(`  [${c.type}]: ${c.text || c.format || ''}`);
    });
  });
}).catch(err => {
  console.error('API Error:', err.response?.data || err.message);
});
