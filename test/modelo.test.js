const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'modelo-test-'));
process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(testDirectory, 'modelo.db');
process.env.JWT_SECRET = 'teste-local-com-segredo-longo-e-isolado-123456789';
process.env.ADMIN_EMAIL = 'gestor@teste.local';
process.env.ADMIN_PASSWORD = 'SenhaGestor!123';
process.env.ADMIN_PHONE = '85999999999';

const { app } = require('../server');
const { initDB, getQuery, closeDB } = require('../db');
const { generateToken } = require('../src/config/jwt');

let server;
let baseUrl;
let adminToken;
let customerToken;
let otherCustomerToken;
let product;
let order;

async function request(route, { method = 'GET', token, body, idempotencyKey } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, headers: response.headers };
}

test.before(async () => {
  await initDB();
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await closeDB();
  fs.rmSync(testDirectory, { recursive: true, force: true });
});

test('health, catálogo inicial e arquivos privados', async () => {
  const health = await request('/health');
  assert.equal(health.status, 200);
  const catalog = await request('/api/products?limit=100');
  assert.equal(catalog.status, 200);
  assert.equal(catalog.data.length, 63);
  product = catalog.data.find(item => item.stock >= 5 && item.price > 0);
  assert.ok(product);
  for (const route of ['/server.js', '/src/config/jwt.js', '/data/modelo.db', '/README.md']) {
    assert.equal((await request(route)).status, 404, route);
  }
});

test('login inválido é rejeitado sem encerrar o servidor', async () => {
  const malformed = await request('/api/auth/manager/login', { method: 'POST', body: { email: 123, password: 'x' } });
  assert.equal(malformed.status, 400);
  assert.equal((await request('/health')).status, 200);
});

test('gestor entra e token de usuário inexistente é rejeitado', async () => {
  const login = await request('/api/auth/manager/login', { method: 'POST', body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
  assert.equal(login.status, 200);
  adminToken = login.data.token;
  const forged = generateToken({ id: 999999, role: 'admin' });
  assert.equal((await request('/api/orders', { token: forged })).status, 401);
});

test('cadastra dois clientes', async () => {
  const register = async (phone, email) => request('/api/auth/register', { method: 'POST', body: {
    name: 'Cliente Piloto', phone, email, password: 'Cliente!123', bairro: 'Centro'
  } });
  const first = await register('85988887777', 'cliente1@teste.local');
  const second = await register('85988886666', 'cliente2@teste.local');
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  customerToken = first.data.token;
  otherCustomerToken = second.data.token;
});

test('pedido exige autenticação, chave idempotente e quantidade válida', async () => {
  const body = { items: [{ id: product.id, quantity: 3 }], delivery_address: 'Rua do Teste, 100', payment_method: 'DINHEIRO' };
  assert.equal((await request('/api/orders', { method: 'POST', body, idempotencyKey: 'pedido-sem-login-0001' })).status, 401);
  assert.equal((await request('/api/orders', { method: 'POST', token: customerToken, body })).status, 400);
  const before = (await getQuery('SELECT stock FROM products WHERE id = ?', [product.id])).stock;
  const invalid = await request('/api/orders', { method: 'POST', token: customerToken, idempotencyKey: 'pedido-quantidade-0001', body: { ...body, items: [{ id: product.id, quantity: -2 }] } });
  assert.equal(invalid.status, 400);
  assert.equal((await getQuery('SELECT stock FROM products WHERE id = ?', [product.id])).stock, before);
});

test('criação calcula valor no servidor e reenvio não duplica baixa', async () => {
  const quantity = Math.max(1, Math.ceil(20 / product.price));
  const body = { items: [{ id: product.id, quantity }], delivery_address: 'Rua do Teste, 100', delivery_fee: -9999, payment_method: 'DINHEIRO' };
  const before = (await getQuery('SELECT stock FROM products WHERE id = ?', [product.id])).stock;
  const first = await request('/api/orders', { method: 'POST', token: customerToken, idempotencyKey: 'pedido-piloto-0000001', body });
  assert.equal(first.status, 201);
  assert.equal(first.data.order.deliveryFee, 5);
  assert.ok(first.data.order.total > 0);
  order = first.data.order;
  const afterFirst = (await getQuery('SELECT stock FROM products WHERE id = ?', [product.id])).stock;
  assert.equal(afterFirst, before - quantity);
  const repeated = await request('/api/orders', { method: 'POST', token: customerToken, idempotencyKey: 'pedido-piloto-0000001', body });
  assert.equal(repeated.status, 200);
  assert.equal(repeated.data.duplicate, true);
  assert.equal((await getQuery('SELECT stock FROM products WHERE id = ?', [product.id])).stock, afterFirst);
});

test('cliente consulta apenas o próprio pedido', async () => {
  assert.equal((await request(`/api/orders/${order.id}`, { token: customerToken })).status, 200);
  assert.equal((await request(`/api/orders/${order.id}`, { token: otherCustomerToken })).status, 403);
  assert.equal((await request(`/api/orders/${order.id}`)).status, 401);
});

test('falta de estoque falha sem zerar saldo', async () => {
  const before = (await getQuery('SELECT stock FROM products WHERE id = ?', [product.id])).stock;
  const response = await request('/api/orders', { method: 'POST', token: customerToken, idempotencyKey: 'pedido-sem-estoque-001', body: {
    items: [{ id: product.id, quantity: 999 }], delivery_address: 'Rua do Teste, 100', payment_method: 'PIX'
  } });
  assert.equal(response.status, 409);
  assert.equal((await getQuery('SELECT stock FROM products WHERE id = ?', [product.id])).stock, before);
});

test('cancelamento restaura estoque somente uma vez', async () => {
  const before = (await getQuery('SELECT stock FROM products WHERE id = ?', [product.id])).stock;
  const cancel = await request(`/api/orders/${order.id}/status`, { method: 'PATCH', token: adminToken, body: { status: 'cancelado' } });
  assert.equal(cancel.status, 200);
  const restored = (await getQuery('SELECT stock FROM products WHERE id = ?', [product.id])).stock;
  assert.ok(restored > before);
  const repeated = await request(`/api/orders/${order.id}/status`, { method: 'PATCH', token: adminToken, body: { status: 'cancelado' } });
  assert.equal(repeated.status, 200);
  assert.equal((await getQuery('SELECT stock FROM products WHERE id = ?', [product.id])).stock, restored);
});

test('produto rejeita preço negativo e edição preserva estoque omitido', async () => {
  assert.equal((await request('/api/products', { method: 'POST', token: adminToken, body: { id: 'invalido', name: 'Inválido', category: 'Teste', price: -1 } })).status, 400);
  const before = await getQuery('SELECT * FROM products WHERE id = ?', [product.id]);
  const edited = await request('/api/products', { method: 'POST', token: adminToken, body: { ...before, stock: undefined, name: before.name } });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.product.stock, before.stock);
});
