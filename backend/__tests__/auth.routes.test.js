const request = require('supertest');
const { app, server } = require('../src/server');
require('./setup');

describe('Auth Routes', () => {
  const basePath = '/api/auth';

  afterAll((done) => {
    server.close(done);
  });

  it('should register a new user', async () => {
    const res = await request(app)
      .post(`${basePath}/register`)
      .send({
        email: 'test@example.com',
        password: 'password123',
        role: 'admin',
        tenantId: 'tenant-auth',
        organizationName: 'Test Org',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe('test@example.com');
  });

  it('should not register with missing fields', async () => {
    const res = await request(app)
      .post(`${basePath}/register`)
      .send({
        email: '',
        password: '',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should login an existing user and return JWT', async () => {
    // First register
    await request(app)
      .post(`${basePath}/register`)
      .send({
        email: 'login@example.com',
        password: 'password123',
        role: 'editor',
        tenantId: 'tenant-auth',
        organizationName: 'Login Org',
      });

    const res = await request(app)
      .post(`${basePath}/login`)
      .send({
        email: 'login@example.com',
        password: 'password123',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });

  it('should reject invalid credentials', async () => {
    const res = await request(app)
      .post(`${basePath}/login`)
      .send({
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should return current user with /me when authorized', async () => {
    const registerRes = await request(app)
      .post(`${basePath}/register`)
      .send({
        email: 'me@example.com',
        password: 'password123',
        role: 'viewer',
        tenantId: 'tenant-auth',
        organizationName: 'Me Org',
      });

    const token = registerRes.body.data.token;

    const res = await request(app)
      .get(`${basePath}/me`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('me@example.com');
  });

  it('should reject /me without token', async () => {
    const res = await request(app).get(`${basePath}/me`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});




