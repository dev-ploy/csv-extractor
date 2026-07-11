const Minio = require('minio');
const config = require('../config');

let minioClient;

function getMinio() {
  if (!minioClient) {
    const endpoint = new URL(config.MINIO_ENDPOINT);
    minioClient = new Minio.Client({
      endPoint: endpoint.hostname,
      port: parseInt(endpoint.port, 10) || 9000,
      useSSL: endpoint.protocol === 'https:',
      accessKey: config.MINIO_ACCESS_KEY,
      secretKey: config.MINIO_SECRET_KEY,
    });
  }
  return minioClient;
}

async function initMinio() {
  const client = getMinio();
  const bucket = config.MINIO_BUCKET;
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket, config.MINIO_REGION);
    console.log(`[MinIO] Bucket "${bucket}" created`);
  } else {
    console.log(`[MinIO] Bucket "${bucket}" exists`);
  }
}

module.exports = { getMinio, initMinio };