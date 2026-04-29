const mongoose = require('mongoose');
const { MONGODB_URI } = require('../src/config/env');

// Use a separate test database if provided, else append -test
const getTestDbUri = () => {
  const uri = process.env.MONGODB_TEST_URI || MONGODB_URI;
  if (process.env.MONGODB_TEST_URI) return uri;
  if (uri.includes('?')) {
    return uri.replace('?', '-test?');
  }
  return `${uri}-test`;
};

beforeAll(async () => {
  const uri = getTestDbUri();
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.connection.close();
});

afterEach(async () => {
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
});




