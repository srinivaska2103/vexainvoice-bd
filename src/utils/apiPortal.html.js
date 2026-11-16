/**
 * Renders a modern Developer API Portal & Route Explorer for localhost:5000
 */
function renderApiPortalHtml() {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VEXA Invoice — API Developer Portal & Route Explorer</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', 'sans-serif'],
            mono: ['"JetBrains Mono"', 'monospace']
          }
        }
      }
    }
  </script>
  <style>
    body { background-color: #0b0f17; color: #f1f5f9; }
    .glass-card { background: rgba(18, 24, 38, 0.7); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.08); }
    .gradient-text { background: linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #e879f9 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .glow-purple { box-shadow: 0 0 30px -5px rgba(129, 140, 248, 0.3); }
    .no-scrollbar::-webkit-scrollbar { display: none; }
  </style>
</head>
<body class="min-h-screen flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
  <!-- Top Navigation Header -->
  <header class="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center font-extrabold text-white text-xl shadow-lg shadow-indigo-500/20">
          V
        </div>
        <div>
          <div class="flex items-center space-x-2">
            <span class="font-bold text-base tracking-tight text-white">VEXA Invoice</span>
            <span class="px-2 py-0.5 text-[10px] font-extrabold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full">v1.0.0 API</span>
          </div>
          <p class="text-[11px] text-slate-400">Commercial Business Billing & ERP API Engine</p>
        </div>
      </div>

      <div class="flex items-center space-x-3">
        <div class="hidden sm:flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-semibold text-emerald-400">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Local Engine Operational</span>
        </div>

        <a href="/api-docs" target="_blank" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center space-x-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
          <span>Open Swagger UI</span>
        </a>
      </div>
    </div>
  </header>

  <!-- Hero Section -->
  <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
    <div class="glass-card p-8 rounded-3xl relative overflow-hidden glow-purple">
      <div class="absolute -right-20 -top-20 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>
      
      <div class="max-w-3xl relative z-10">
        <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          Interactive API <span class="gradient-text">Developer Portal</span>
        </h1>
        <p class="mt-3 text-sm text-slate-300 leading-relaxed">
          Configure, test, and integrate VEXA Invoice REST endpoints. Built with Express, PostgreSQL, Prisma ORM, JWT security, and real-time inventory calculation.
        </p>

        <!-- Quick Bearer Token Setting -->
        <div class="mt-6 p-4 bg-slate-950/60 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center gap-3">
          <div class="flex-1 w-full">
            <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Authorization Bearer JWT Token</label>
            <input id="jwtTokenInput" type="text" placeholder="Paste your JWT token here to authenticate requests..." class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-indigo-300 font-mono focus:outline-none focus:border-indigo-500">
          </div>
          <button onclick="saveJwtToken()" class="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all whitespace-nowrap">
            Save Token
          </button>
        </div>
      </div>
    </div>

    <!-- API Service Categories & Search -->
    <div class="mt-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center space-x-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar" id="categoryTabs">
        <!-- Dynamic Tabs -->
      </div>
      <div class="w-full sm:w-72">
        <input id="routeSearch" type="text" placeholder="Filter API routes..." onkeyup="filterRoutes()" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500">
      </div>
    </div>

    <!-- Route Grid -->
    <div id="routesContainer" class="mt-6 grid grid-cols-1 gap-4">
      <!-- Dynamic Routes rendered here -->
    </div>
  </section>

  <!-- Interactive Test Modal -->
  <div id="testModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
      <div class="p-5 border-b border-slate-800 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <span id="modalMethodBadge" class="px-2.5 py-1 text-xs font-extrabold rounded-lg uppercase">GET</span>
          <span id="modalPath" class="text-sm font-bold text-white font-mono">/api/route</span>
        </div>
        <button onclick="closeTestModal()" class="text-slate-400 hover:text-white p-1">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      <div class="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
        <div>
          <label class="block font-semibold text-slate-400 mb-1">Description</label>
          <p id="modalDesc" class="text-slate-200"></p>
        </div>

        <div id="reqBodySection" class="hidden">
          <label class="block font-semibold text-slate-400 mb-1">Request Body (JSON)</label>
          <textarea id="modalReqBody" rows="6" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-indigo-300 focus:outline-none focus:border-indigo-500"></textarea>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="font-semibold text-slate-400">Response Data</label>
            <span id="modalStatus" class="font-mono text-emerald-400 font-bold"></span>
          </div>
          <pre id="modalResponse" class="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-slate-300 overflow-x-auto max-h-60 text-[11px]">Click "Send Test Request" below to execute API call...</pre>
        </div>
      </div>

      <div class="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end space-x-3">
        <button onclick="closeTestModal()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl">Close</button>
        <button id="sendBtn" onclick="executeTestRequest()" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/20">Send Test Request</button>
      </div>
    </div>
  </div>

  <script>
    const ROUTES_DATA = [
      // Health
      { method: 'GET', path: '/api/health', category: 'Health', desc: 'Check backend server health & database connectivity', body: null },
      
      // Auth
      { method: 'POST', path: '/api/auth/register', category: 'Auth', desc: 'Register a new business and admin user account', body: { business_name: "Royal Textiles", business_type: "GARMENT_TEXTILE", owner_name: "Owner", phone: "9876543210", email: "admin_" + Date.now() + "@royal.com", admin_name: "Admin User", password: "Password@123" } },
      { method: 'POST', path: '/api/auth/login', category: 'Auth', desc: 'Authenticate user & receive JWT bearer token', body: { email: "admin@vexainvoice.com", password: "Password@123" } },
      { method: 'GET', path: '/api/auth/me', category: 'Auth', desc: 'Fetch authenticated user & business profile', body: null },

      // Products
      { method: 'GET', path: '/api/products', category: 'Products', desc: 'Get paginated catalog products list', body: null },
      { method: 'POST', path: '/api/products', category: 'Products', desc: 'Create new product entry with optional garment variants', body: { name: "Cotton Kurti - Full Sleeve", sku: "KURTI-" + Math.floor(Math.random()*10000), retail_price: 1200, wholesale_price: 950, purchase_price: 700, opening_stock: 50, unit: "PCS" } },
      { method: 'GET', path: '/api/products/categories', category: 'Products', desc: 'Get product categories list', body: null },
      { method: 'GET', path: '/api/products/brands', category: 'Products', desc: 'Get product brands list', body: null },

      // Customers & Suppliers
      { method: 'GET', path: '/api/customers', category: 'Parties', desc: 'Get all registered retail & wholesale customers', body: null },
      { method: 'POST', path: '/api/customers', category: 'Parties', desc: 'Add new customer party account', body: { name: "Supreme Garments Store", customer_type: "WHOLESALE", phone: "9842100000", gstin: "33AAAAA0000A1Z5" } },
      { method: 'GET', path: '/api/suppliers', category: 'Parties', desc: 'Get registered manufacturers & suppliers', body: null },
      { method: 'POST', path: '/api/suppliers', category: 'Parties', desc: 'Add new supplier vendor', body: { name: "Tirupur Knitting Mills", phone: "9842100000", city: "Tirupur" } },

      // Sales & POS
      { method: 'GET', path: '/api/sales', category: 'Sales', desc: 'Get sales invoice history list', body: null },
      { method: 'POST', path: '/api/sales', category: 'Sales', desc: 'Create new POS counter / Wholesale bill', body: { invoiceType: "RETAIL", paymentMethod: "CASH", items: [{ productId: "SAMPLE_PROD_ID", quantity: 1, unitPrice: 1200 }] } },

      // Purchases & Stock
      { method: 'GET', path: '/api/purchases', category: 'Purchases', desc: 'Get inward purchase vendor bills', body: null },
      { method: 'GET', path: '/api/stock', category: 'Stock', desc: 'Get real-time stock balances & low stock alerts', body: null },

      // Reports
      { method: 'GET', path: '/api/reports/dashboard', category: 'Reports', desc: 'Fetch real-time executive dashboard KPIs', body: null },
      { method: 'GET', path: '/api/reports/gst', category: 'Reports', desc: 'Generate GSTR-1 tax liability summary', body: null }
    ];

    let activeCategory = 'All';
    let currentTestRoute = null;

    function init() {
      renderCategories();
      renderRoutes();
      document.getElementById('jwtTokenInput').value = localStorage.getItem('vexa_jwt_token') || '';
    }

    function saveJwtToken() {
      const token = document.getElementById('jwtTokenInput').value.trim();
      localStorage.setItem('vexa_jwt_token', token);
      alert('JWT Token saved for API explorer testing!');
    }

    function renderCategories() {
      const categories = ['All', 'Health', 'Auth', 'Products', 'Parties', 'Sales', 'Purchases', 'Stock', 'Reports'];
      const container = document.getElementById('categoryTabs');
      container.innerHTML = categories.map(cat => \`
        <button onclick="selectCategory('\${cat}')" class="px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all \${activeCategory === cat ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}\">
          \${cat}
        </button>
      \`).join('');
    }

    function selectCategory(cat) {
      activeCategory = cat;
      renderCategories();
      renderRoutes();
    }

    function filterRoutes() {
      renderRoutes();
    }

    function renderRoutes() {
      const search = document.getElementById('routeSearch').value.toLowerCase();
      const container = document.getElementById('routesContainer');
      
      const filtered = ROUTES_DATA.filter(r => {
        const matchesCat = activeCategory === 'All' || r.category === activeCategory;
        const matchesSearch = r.path.toLowerCase().includes(search) || r.desc.toLowerCase().includes(search);
        return matchesCat && matchesSearch;
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div class="p-8 text-center text-slate-500 text-xs">No matching API routes found.</div>';
        return;
      }

      container.innerHTML = filtered.map((r, i) => \`
        <div class="glass-card p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-indigo-500/40 transition-all">
          <div class="flex items-center space-x-3">
            <span class="px-2.5 py-1 text-[11px] font-extrabold rounded-lg font-mono \${
              r.method === 'GET' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              r.method === 'POST' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }\">\${r.method}</span>
            <div>
              <span class="text-sm font-bold text-white font-mono">\${r.path}</span>
              <p class="text-xs text-slate-400 mt-0.5">\${r.desc}</p>
            </div>
          </div>
          <div class="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button onclick="openTestModal(\${ROUTES_DATA.indexOf(r)})" class="px-3.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-xl text-xs font-semibold transition-all">
              Test Endpoint
            </button>
          </div>
        </div>
      \`).join('');
    }

    function openTestModal(index) {
      currentTestRoute = ROUTES_DATA[index];
      document.getElementById('modalMethodBadge').innerText = currentTestRoute.method;
      document.getElementById('modalMethodBadge').className = \`px-2.5 py-1 text-xs font-extrabold rounded-lg uppercase \${
        currentTestRoute.method === 'GET' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
      }\`;
      document.getElementById('modalPath').innerText = currentTestRoute.path;
      document.getElementById('modalDesc').innerText = currentTestRoute.desc;

      const bodySec = document.getElementById('reqBodySection');
      if (currentTestRoute.method === 'POST' || currentTestRoute.method === 'PUT') {
        bodySec.classList.remove('hidden');
        document.getElementById('modalReqBody').value = JSON.stringify(currentTestRoute.body, null, 2);
      } else {
        bodySec.classList.add('hidden');
      }

      document.getElementById('modalStatus').innerText = '';
      document.getElementById('modalResponse').innerText = 'Click "Send Test Request" below to execute API call...';
      document.getElementById('testModal').classList.remove('hidden');
    }

    function closeTestModal() {
      document.getElementById('testModal').classList.add('hidden');
    }

    async function executeTestRequest() {
      if (!currentTestRoute) return;
      const sendBtn = document.getElementById('sendBtn');
      sendBtn.innerText = 'Sending...';
      sendBtn.disabled = true;

      const token = localStorage.getItem('vexa_jwt_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;

      const options = {
        method: currentTestRoute.method,
        headers
      };

      if (currentTestRoute.method === 'POST' || currentTestRoute.method === 'PUT') {
        try {
          options.body = document.getElementById('modalReqBody').value;
        } catch (e) {
          alert('Invalid JSON in request body');
          sendBtn.innerText = 'Send Test Request';
          sendBtn.disabled = false;
          return;
        }
      }

      try {
        const startTime = performance.now();
        const res = await fetch(currentTestRoute.path, options);
        const endTime = performance.now();
        const data = await res.json();

        document.getElementById('modalStatus').innerText = \`HTTP \${res.status} (\${Math.round(endTime - startTime)}ms)\`;
        document.getElementById('modalResponse').innerText = JSON.stringify(data, null, 2);
      } catch (err) {
        document.getElementById('modalStatus').innerText = 'ERROR';
        document.getElementById('modalResponse').innerText = err.message || 'Failed to connect to API server';
      } finally {
        sendBtn.innerText = 'Send Test Request';
        sendBtn.disabled = false;
      }
    }

    init();
  </script>
</body>
</html>`;
}

module.exports = { renderApiPortalHtml };
