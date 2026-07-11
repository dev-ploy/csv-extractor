-- CreateTable
CREATE TABLE "upload_sessions" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "original_csv" TEXT NOT NULL,
    "header_mapping" JSONB,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "upload_session_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" VARCHAR(320),
    "country_code" VARCHAR(5),
    "mobile_without_country_code" VARCHAR(20),
    "company" VARCHAR(255),
    "city" VARCHAR(255),
    "state" VARCHAR(255),
    "country" VARCHAR(255),
    "lead_owner" VARCHAR(255),
    "crm_status" VARCHAR(100),
    "crm_note" TEXT,
    "data_source" VARCHAR(255),
    "possession_time" TIMESTAMP(3),
    "description" TEXT,
    "raw_data" JSONB,
    "import_status" TEXT NOT NULL DEFAULT 'parsed',
    "skip_reason" TEXT,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "upload_sessions_status_idx" ON "upload_sessions"("status");

-- CreateIndex
CREATE INDEX "upload_sessions_expires_at_idx" ON "upload_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX "leads_upload_session_id_idx" ON "leads"("upload_session_id");

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "leads_upload_session_id_email_key" ON "leads"("upload_session_id", "email");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_upload_session_id_fkey" FOREIGN KEY ("upload_session_id") REFERENCES "upload_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

