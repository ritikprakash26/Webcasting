const path = require('path');
const fs = require('fs');
const request = require('supertest');
const { app, server } = require('../src/server');
const Video = require('../src/models/Video');
const Organization = require('../src/models/Organization');
const User = require('../src/models/User');
const { generateToken } = require('../src/controllers/auth.controller');
require('./setup');

describe('Video Streaming Route', () => {
  const videoBase = '/api/videos';

  let tenantId = 'tenant-stream';
  let user;
  let org;
  let video;
  let token;
  let videoFilePath;

  beforeAll(async () => {
    // Create organization and user manually
    org = await Organization.create({
      name: 'Stream Org',
      tenantId,
    });

    user = await User.create({
      email: 'streamer@example.com',
      password: 'password123',
      role: 'viewer',
      tenantId,
      organization: org._id,
    });

    token = generateToken(user._id.toString(), user.role, tenantId);

    // Create dummy video file
    const dir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    videoFilePath = path.join(dir, 'stream.mp4');
    if (!fs.existsSync(videoFilePath)) {
      fs.writeFileSync(videoFilePath, 'dummy streaming content');
    }

    // Create video document marked as ready
    video = await Video.create({
      title: 'Stream Test Video',
      description: 'Video ready for streaming',
      filename: 'stream.mp4',
      originalFilename: 'stream.mp4',
      originalFilePath: videoFilePath,
      processedFilePath: null,
      fileSize: fs.statSync(videoFilePath).size,
      mimeType: 'video/mp4',
      status: 'ready',
      tenantId,
      organization: org._id,
      uploadedBy: user._id,
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  it('should require authentication token for streaming', async () => {
    const res = await request(app).get(`/api/videos/stream/${video._id}`);
    expect(res.status).toBe(401);
  });

  it('should stream video with full content when no Range header', async () => {
    const res = await request(app).get(`/api/videos/stream/${video._id}?token=${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('video');
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.headers['content-length']).toBeDefined();
  });

  it('should stream partial content (206) when Range header is provided', async () => {
    const res = await request(app)
      .get(`/api/videos/stream/${video._id}?token=${token}`)
      .set('Range', 'bytes=0-9');

    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toMatch(/^bytes 0-9\/\d+$/);
    expect(res.headers['content-length']).toBe('10');
  });
});




