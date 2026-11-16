const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');

const token = process.env.WHATSAPP_ACCESS_TOKEN;
const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

async function getAllTemplates() {
  let url = `https://graph.facebook.com/v20.0/${wabaId}/message_templates?limit=100`;
  let all = [];
  while (url) {
    const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
    all = all.concat(res.data.data);
    url = res.data.paging && res.data.paging.next ? res.data.paging.next : null;
  }
  console.log(`Found ${all.length} templates:`);
  all.forEach(t => console.log(`- ${t.name} (${t.status}, ${t.category}, ${t.language})`));
}

getAllTemplates().catch(console.error);

