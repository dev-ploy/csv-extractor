-- Create users table
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(320) NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Seed admin user (password: admin123)
INSERT INTO "users" ("id", "email", "password", "name", "role", "created_at")
VALUES (
    gen_random_uuid(),
    'admin@csv-extractor.com',
    '$2b$12$VrCyi2oVfjElviqCO6CTa.NvyNj.c.v.jR.BSOjv2BNZW42/e.lTe',
    'Admin',
    'admin',
    NOW()
);

-- Seed regular user (password: user123)
INSERT INTO "users" ("id", "email", "password", "name", "role", "created_at")
VALUES (
    gen_random_uuid(),
    'user@csv-extractor.com',
    '$2b$12$Z.8N3RnDZkQqJl5JusszteZR2Nwwbsd9s2qk0GhA4ygzW0uLsJ0Wq',
    'User',
    'user',
    NOW()
);

-- Add created_by to upload_sessions
ALTER TABLE "upload_sessions" ADD COLUMN "created_by" UUID;

CREATE INDEX "upload_sessions_created_by_idx" ON "upload_sessions"("created_by");

ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Update migration tracking
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    gen_random_uuid(),
    'd41d8cd98f00b204e9800998ecf8427e',
    NOW(),
    '00002_add_users_auth',
    NULL,
    NULL,
    NOW(),
    1
);