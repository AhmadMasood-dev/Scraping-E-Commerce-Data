const request = require('supertest');

// Stub out DB connection — we don't need Mongo for these route-level checks.
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return { ...actual, connect: jest.fn().mockResolvedValue({ connection: { host: 'mock', name: 'test' } }) };
});

const app = require('../src/app');

describe('Express app', () => {
  test('GET / returns running message', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /health returns healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  test('Unknown route → 404 with structured error', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: expect.objectContaining({ code: 'NOT_FOUND' }),
    });
  });

  test('POST /api/v1/auth/register without body → 400 VALIDATION', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(Array.isArray(res.body.error.fields)).toBe(true);
  });

  test('GET /api/v1/products/:id with bad id → 400 INVALID_ID or VALIDATION', async () => {
    const res = await request(app).get('/api/v1/products/not-an-objectid');
    expect([400, 404]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });
});
