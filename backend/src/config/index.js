const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const config = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgredb',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 25,

  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY || 'minioadmin',
  MINIO_BUCKET: process.env.MINIO_BUCKET || 'csv-uploads',
  MINIO_REGION: process.env.MINIO_REGION || 'us-east-1',

  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  HF_TOKEN: process.env.HF_TOKEN || '',
  LLM_MODEL: process.env.LLM_MODEL || 'google/gemma-4-31B-it',

  get isDev() { return this.NODE_ENV === 'development'; },
  get isProd() { return this.NODE_ENV === 'production'; },

  SCHEMA_FIELDS: [
    'created_at', 'email', 'country_code', 'mobile_without_country_code',
    'company', 'city', 'state', 'country', 'lead_owner', 'crm_status',
    'crm_note', 'data_source', 'possession_time', 'description',
  ],

  BATCH_SIZE: parseInt(process.env.BATCH_SIZE, 10) || 50,
  MAX_PREVIEW_ROWS: 10,
};

module.exports = config;