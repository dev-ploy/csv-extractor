-- AlterTable: make original_csv nullable, add minio_key
ALTER TABLE "upload_sessions" ALTER COLUMN "original_csv" DROP NOT NULL;
ALTER TABLE "upload_sessions" ADD COLUMN "minio_key" TEXT;
CREATE INDEX "upload_sessions_minio_key_idx" ON "upload_sessions"("minio_key");