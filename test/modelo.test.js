const assert = require('assert');
const http = require('http');
const { app } = require('../server');
const { getQuery } = require('../db');

let server;
const PORT = 3099;
const BASE_URL = `http://localhost:${PORT}`;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, headers: res.headers, body: json, text: data });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, text: data });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Iniciando suíte de testes automatizados do Super Mercado Modelo...');

  server = app.listen(PORT);
  await new Promise(resolve => setTimeout(resolve, 500));

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASSOU: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FALHOU: ${name}`, err.message);
      failed++;
    }
  }

  // 1. Health check
  await test('GET /health responde status ok', async () => {
    const res = await request('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.strictEqual(res.body.app, 'Super Mercado Modelo');
  });

  // 2. Store Info
  await test('GET /api/auth/store-info retorna dados da loja única', async () => {
    const res = await request('/api/auth/store-info');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.store.name, 'Super Mercado Modelo');
    assert.strictEqual(res.body.store.city, 'Cascavel - CE');
  });

  // 3. Products Catalog (63 real items seeded)
  await test('GET /api/products retorna catálogo de produtos dedicados', async () => {
    const res = await request('/api/products?limit=100');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.strictEqual(res.body.length, 63);
    assert.ok(res.body[0].name);
    assert.ok(res.body[0].price);
  });

  // 4. Products Search and Category Filter
  await test('GET /api/products com filtro de categoria e busca funciona', async () => {
    const resCat = await request('/api/products?category=Hortifruti');
    assert.strictEqual(resCat.status, 200);
    assert.ok(resCat.body.length > 0);
    resCat.body.forEach(p => assert.strictEqual(p.category, 'Hortifruti'));

    const resSearch = await request('/api/products?q=Arroz');
    assert.strictEqual(resSearch.status, 200);
    assert.ok(resSearch.body.length > 0);
    assert.ok(resSearch.body.some(p => p.name.toLowerCase().includes('arroz')));
  });

  // 5. Manager Login (Login & Senha direto)
  let adminToken = '';
  await test('POST /api/auth/manager/login realiza login direto do gestor', async () => {
    const res = await request('/api/auth/manager/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        email: 'admin@supermercadomodelo.com.br',
        password: 'admin123'
      }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.role, 'admin');
    assert.strictEqual(res.body.store.name, 'Super Mercado Modelo');
    adminToken = res.body.token;
  });

  // 6. Customer Register & Login
  const customerEmail = `cliente_${Date.now()}@teste.com`;
  const customerPhone = '(85) 9' + Math.floor(10000000 + Math.random() * 90000000);
  let customerToken = '';
  await test('POST /api/auth/customer/register cadastra cliente para o Modelo', async () => {
    const res = await request('/api/auth/customer/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        name: 'Carlos Oliveira',
        email: customerEmail,
        password: 'senhaSegura123',
        phone: customerPhone,
        bairro: 'Centro'
      }
    });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.email, customerEmail);
    customerToken = res.body.token;
  });

  // 7. Order Placement & Inventory Decrement
  let createdOrderId = '';
  let orderNumber = '';
  await test('POST /api/orders realiza pedido com sucesso gerando MOD-XXXXXX', async () => {
    const prods = await request('/api/products?limit=2');
    const item1 = prods.body[0];
    const initialStock = item1.stock !== undefined ? item1.stock : item1.stock_quantity;

    const res = await request('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: {
        items: [{ id: item1.id, quantity: 2 }],
        customer_name: 'Carlos Oliveira',
        customer_phone: customerPhone,
        delivery_address: 'Rua das Palmeiras, 100, Centro, Cascavel - CE',
        payment_method: 'PIX',
        delivery_fee: 5.00
      }
    });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.order);
    assert.ok(res.body.order.order_number.startsWith('MOD-'));
    createdOrderId = res.body.order.id;
    orderNumber = res.body.order.order_number;

    // Verify inventory decrement
    const updatedProd = await getQuery('SELECT stock FROM products WHERE id = ?', [item1.id]);
    assert.strictEqual(updatedProd.stock, initialStock - 2);
  });

  // 8. Order Status Update by Manager
  await test('PATCH /api/orders/:id/status atualiza status para SAIU_ENTREGA', async () => {
    const res = await request(`/api/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: { status: 'SAIU_ENTREGA' }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.order.status, 'SAIU_ENTREGA');
  });

  server.close();

  console.log('\n==============================================');
  console.log(`📊 Resultado dos Testes: ${passed} passaram, ${failed} falharam.`);
  console.log('==============================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  if (server) server.close();
  process.exit(1);
});
