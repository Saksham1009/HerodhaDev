const { createClient } = require('redis');

const redisClient = createClient({
  url: 'redis://redis:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('Redis: Too many retry attempts. Giving up.');
        return new Error('Retry attempts exhausted');
      }
      const delay = Math.min(retries * 100, 3000);
      console.warn(`Redis: Retry attempt ${retries}, reconnecting in ${delay}ms`);
      return delay;
    }
  }
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('Redis client trying to connect...');
});

redisClient.on('ready', () => {
  console.log('Redis client connected and ready!');
});

(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Redis initial connection failed:', err);
  }
})();

module.exports = redisClient;
