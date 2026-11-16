const http = require('http');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const prisma = require('../src/config/db');

function makeRequest(server, path, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const options = {
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, body: json });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runSuperAdminTests() {
  console.log('\n======================================================');
  console.log('🛡️  RUNNING VEXA TECH SUPER ADMIN TEST SUITE (WITH OTP)');
  console.log('======================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    // 1. Unauthenticated request to /api/super-admin/dashboard must be rejected (401)
    const unauthRes = await makeRequest(server, '/api/super-admin/dashboard');
    if (unauthRes.status === 401) {
      console.log('✅ Test 1 Passed: Unauthorized request safely rejected with 401');
    } else {
      throw new Error(`Test 1 Failed: Expected 401, got ${unauthRes.status}`);
    }

    // 2. Reject non-allowed email for Super Admin OTP
    const wrongEmailRes = await makeRequest(
      server,
      '/api/super-admin/send-otp',
      'POST',
      {},
      { email: 'random.user@gmail.com' }
    );
    if (wrongEmailRes.status === 403) {
      console.log('✅ Test 2 Passed: Non-authorized email strictly rejected (403)');
    } else {
      throw new Error(`Test 2 Failed: Expected 403 for wrong email, got ${wrongEmailRes.status}`);
    }

    // 3. Dispatch OTP for authorized email vexatech.connect@gmail.com
    const otpRes = await makeRequest(
      server,
      '/api/super-admin/send-otp',
      'POST',
      {},
      { email: 'vexatech.connect@gmail.com' }
    );
    if (otpRes.status === 200) {
      console.log('✅ Test 3 Passed: OTP dispatched for vexatech.connect@gmail.com');
    } else {
      throw new Error(`Test 3 Failed: OTP dispatch failed with status ${otpRes.status}`);
    }

    // 4. Test wrong OTP rejection
    const wrongOtpRes = await makeRequest(
      server,
      '/api/super-admin/verify-otp',
      'POST',
      {},
      { email: 'vexatech.connect@gmail.com', otp: '000000' }
    );
    if (wrongOtpRes.status === 400) {
      console.log('✅ Test 4 Passed: Incorrect OTP code safely rejected (400)');
    } else {
      throw new Error(`Test 4 Failed: Expected 400 for incorrect OTP, got ${wrongOtpRes.status}`);
    }

    // 5. Normal Company ADMIN token must NOT grant Super Admin access (403)
    const companyUser = await prisma.users.findFirst({ where: { role: 'ADMIN' } });
    if (!companyUser) throw new Error('No company admin user found for testing');

    const fakeCompanyToken = jwt.sign(
      { id: companyUser.id, business_id: companyUser.business_id, role: 'ADMIN' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const normalAdminRes = await makeRequest(
      server,
      '/api/super-admin/dashboard',
      'GET',
      { Authorization: `Bearer ${fakeCompanyToken}` }
    );
    if (normalAdminRes.status === 403) {
      console.log('✅ Test 5 Passed: Company ADMIN strictly denied platform Super Admin access (403)');
    } else {
      throw new Error(`Test 5 Failed: Expected 403, got ${normalAdminRes.status}`);
    }

    // 6. Direct Super Admin token verification & dashboard integrity
    const adminRecord = await prisma.admin_users.findFirst({
      where: { email: 'vexatech.connect@gmail.com' }
    });
    const validSuperAdminToken = jwt.sign(
      { id: adminRecord.id, email: adminRecord.email, role: 'SUPER_ADMIN', is_super_admin: true },
      env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const authHeaders = { Authorization: `Bearer ${validSuperAdminToken}` };
    const dashboardRes = await makeRequest(server, '/api/super-admin/dashboard', 'GET', authHeaders);

    if (dashboardRes.status === 200) {
      const data = dashboardRes.body.data;
      console.log(`✅ Test 6 Passed: Super Admin Dashboard successfully accessible (Total Companies: ${data.companies.total})`);
    } else {
      throw new Error(`Test 6 Failed: Dashboard endpoint error ${dashboardRes.status}`);
    }

    console.log('\n🎉 ALL SUPER ADMIN OTP & ACCESS TESTS PASSED!\n');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ SUPER ADMIN TEST FAILURE:', err);
    server.close();
    process.exit(1);
  }
}

runSuperAdminTests();
