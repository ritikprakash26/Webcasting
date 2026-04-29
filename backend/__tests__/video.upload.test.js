const path = require('path');
const fs = require('fs');
const request = require('supertest');
const { app, server } = require('../src/server');
require('./setup');

// Helper to create a small dummy file for upload
const getDummyVideoPath = () => {
  const dir = path.join(__dirname, 'fixtures');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, 'dummy.mp4');
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, 'dummy video content');
  }
  return filePath;
};

describe('Video Upload Route', () => {
  const authBase = '/api/auth';
  const videoBase = '/api/videos';

  let editorToken;

  beforeAll(async () => {
    // Register editor user
    const res = await request(app)
      .post(`${authBase}/register`)
      .send({
        email: 'uploader@example.com',
        password: 'password123',
        role: 'editor',
        tenantId: 'tenant-upload',
        organizationName: 'Upload Org',
      });

    editorToken = res.body.data.token;
  });

  afterAll((done) => {
    server.close(done);
  });

  it('should reject upload without auth token', async () => {
    const res = await request(app)
      .post(`${videoBase}/upload`)
      .attach('video', getDummyVideoPath());

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should upload a video with valid editor token', async () => {
    const res = await request(app)
      .post(`${videoBase}/upload`)
      .set('Authorization', `Bearer ${editorToken}`)
      .attach('video', getDummyVideoPath())
      .field('title', 'Test Video')
      .field('description', 'Test upload');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.video).toBeDefined();
    expect(res.body.data.video.title).toBe('Test Video');
  });

  it('should reject upload when no file is provided', async () => {
    const res = await request(app)
      .post(`${videoBase}/upload`)
      .set('Authorization', `Bearer ${editorToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});




