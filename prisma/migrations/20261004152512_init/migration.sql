-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CIVILIAN', 'VOLUNTEER', 'RESPONDER', 'ADMIN');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('MEDICAL', 'TRAPPED', 'FLOOD', 'FIRE', 'BUILDING_COLLAPSE', 'MISSING_PERSON', 'FOOD_WATER', 'EVACUATION', 'OTHER');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "PeopleCount" AS ENUM ('ONE', 'TWO_TO_FIVE', 'SIX_TO_TEN', 'MORE_THAN_TEN');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('PENDING', 'RECEIVED', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LocationSource" AS ENUM ('GPS', 'MANUAL', 'SAVED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'ADVISORY', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SafetyState" AS ENUM ('SAFE', 'NEED_ASSISTANCE', 'EMERGENCY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ShelterStatus" AS ENUM ('OPEN', 'FULL', 'CLOSED');

-- CreateEnum
CREATE TYPE "ContactService" AS ENUM ('EMERGENCY', 'POLICE', 'FIRE_RESCUE', 'AMBULANCE', 'DISASTER_MANAGEMENT', 'CONTROL_ROOM', 'HOSPITAL', 'SHELTER_COORDINATOR', 'HELPLINE', 'SUPPORT');

-- CreateEnum
CREATE TYPE "SyncEntityType" AS ENUM ('INCIDENT', 'SAFETY_STATUS');

-- CreateEnum
CREATE TYPE "SyncOperationType" AS ENUM ('CREATE', 'CANCEL');

-- CreateEnum
CREATE TYPE "SyncResultStatus" AS ENUM ('APPLIED', 'DUPLICATE', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(20),
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CIVILIAN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "family_id" UUID NOT NULL,
    "user_agent" VARCHAR(300),
    "ip_address" VARCHAR(64),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "agency" VARCHAR(120),
    "unit_code" VARCHAR(40),
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "responders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "region" VARCHAR(120),
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "volunteers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disaster_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "disaster_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "service" "ContactService" NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "region" VARCHAR(120),
    "description" VARCHAR(300),
    "available_24x7" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_guides" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "disaster_type_id" UUID NOT NULL,
    "summary" VARCHAR(400) NOT NULL,
    "sections" JSONB NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "safety_guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "disaster_type_id" UUID NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "region" VARCHAR(120) NOT NULL,
    "message" VARCHAR(1000) NOT NULL,
    "instruction" VARCHAR(1000) NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shelters" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "address" VARCHAR(300) NOT NULL,
    "region" VARCHAR(120) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "capacity" INTEGER NOT NULL,
    "occupancy" INTEGER NOT NULL DEFAULT 0,
    "facilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contact_phone" VARCHAR(20),
    "accessibility_info" VARCHAR(500),
    "status" "ShelterStatus" NOT NULL DEFAULT 'OPEN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shelters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shelter_resources" (
    "id" UUID NOT NULL,
    "shelter_id" UUID NOT NULL,
    "resource_type" VARCHAR(60) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unit" VARCHAR(20) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shelter_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "reference_code" VARCHAR(12) NOT NULL,
    "reporter_id" UUID,
    "device_id" UUID,
    "type" "IncidentType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "people_count" "PeopleCount" NOT NULL,
    "special_requirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" VARCHAR(500),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracy_meters" DOUBLE PRECISION,
    "location_text" VARCHAR(200),
    "location_source" "LocationSource" NOT NULL,
    "contact_phone" VARCHAR(20),
    "status" "IncidentStatus" NOT NULL DEFAULT 'RECEIVED',
    "priority_score" INTEGER NOT NULL DEFAULT 0,
    "priority_reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assigned_responder_id" UUID,
    "assigned_volunteer_id" UUID,
    "client_created_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "assigned_at" TIMESTAMPTZ(3),
    "resolved_at" TIMESTAMPTZ(3),
    "sync_source" VARCHAR(10) NOT NULL DEFAULT 'DIRECT',
    "is_demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_updates" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "author_id" UUID,
    "status" "IncidentStatus",
    "note" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_safety_status" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "user_id" UUID,
    "device_id" UUID,
    "status" "SafetyState" NOT NULL,
    "note" VARCHAR(280),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "client_created_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_safety_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "user_id" UUID,
    "entity_type" "SyncEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "operation_type" "SyncOperationType" NOT NULL,
    "result" "SyncResultStatus" NOT NULL,
    "server_id" UUID,
    "error" VARCHAR(300),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "queued_at" TIMESTAMPTZ(3) NOT NULL,
    "processed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(60) NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" VARCHAR(64),
    "metadata" JSONB,
    "ip_address" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_token_hash_key" ON "refresh_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_sessions_user_id_idx" ON "refresh_sessions"("user_id");

-- CreateIndex
CREATE INDEX "refresh_sessions_family_id_idx" ON "refresh_sessions"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "responders_user_id_key" ON "responders"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "volunteers_user_id_key" ON "volunteers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "disaster_types_code_key" ON "disaster_types"("code");

-- CreateIndex
CREATE INDEX "emergency_contacts_region_idx" ON "emergency_contacts"("region");

-- CreateIndex
CREATE UNIQUE INDEX "safety_guides_slug_key" ON "safety_guides"("slug");

-- CreateIndex
CREATE INDEX "safety_guides_disaster_type_id_idx" ON "safety_guides"("disaster_type_id");

-- CreateIndex
CREATE INDEX "alerts_is_active_expires_at_idx" ON "alerts"("is_active", "expires_at");

-- CreateIndex
CREATE INDEX "alerts_region_idx" ON "alerts"("region");

-- CreateIndex
CREATE INDEX "shelters_region_idx" ON "shelters"("region");

-- CreateIndex
CREATE INDEX "shelters_latitude_longitude_idx" ON "shelters"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "shelter_resources_shelter_id_resource_type_key" ON "shelter_resources"("shelter_id", "resource_type");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_client_id_key" ON "incidents"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_reference_code_key" ON "incidents"("reference_code");

-- CreateIndex
CREATE INDEX "incidents_status_severity_idx" ON "incidents"("status", "severity");

-- CreateIndex
CREATE INDEX "incidents_created_at_idx" ON "incidents"("created_at");

-- CreateIndex
CREATE INDEX "incidents_device_id_idx" ON "incidents"("device_id");

-- CreateIndex
CREATE INDEX "incidents_reporter_id_idx" ON "incidents"("reporter_id");

-- CreateIndex
CREATE INDEX "incidents_assigned_responder_id_idx" ON "incidents"("assigned_responder_id");

-- CreateIndex
CREATE INDEX "incidents_assigned_volunteer_id_idx" ON "incidents"("assigned_volunteer_id");

-- CreateIndex
CREATE INDEX "incident_updates_incident_id_created_at_idx" ON "incident_updates"("incident_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_safety_status_client_id_key" ON "user_safety_status"("client_id");

-- CreateIndex
CREATE INDEX "user_safety_status_user_id_client_created_at_idx" ON "user_safety_status"("user_id", "client_created_at");

-- CreateIndex
CREATE INDEX "user_safety_status_device_id_client_created_at_idx" ON "user_safety_status"("device_id", "client_created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sync_logs_operation_id_key" ON "sync_logs"("operation_id");

-- CreateIndex
CREATE INDEX "sync_logs_device_id_processed_at_idx" ON "sync_logs"("device_id", "processed_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responders" ADD CONSTRAINT "responders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_guides" ADD CONSTRAINT "safety_guides_disaster_type_id_fkey" FOREIGN KEY ("disaster_type_id") REFERENCES "disaster_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_disaster_type_id_fkey" FOREIGN KEY ("disaster_type_id") REFERENCES "disaster_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shelter_resources" ADD CONSTRAINT "shelter_resources_shelter_id_fkey" FOREIGN KEY ("shelter_id") REFERENCES "shelters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assigned_responder_id_fkey" FOREIGN KEY ("assigned_responder_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assigned_volunteer_id_fkey" FOREIGN KEY ("assigned_volunteer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_updates" ADD CONSTRAINT "incident_updates_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_updates" ADD CONSTRAINT "incident_updates_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_safety_status" ADD CONSTRAINT "user_safety_status_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- Data-integrity CHECK constraints (not expressible in Prisma schema)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "shelters"
  ADD CONSTRAINT "shelters_capacity_positive"   CHECK ("capacity" > 0),
  ADD CONSTRAINT "shelters_occupancy_nonneg"    CHECK ("occupancy" >= 0),
  ADD CONSTRAINT "shelters_latitude_range"      CHECK ("latitude"  BETWEEN -90  AND 90),
  ADD CONSTRAINT "shelters_longitude_range"     CHECK ("longitude" BETWEEN -180 AND 180);

ALTER TABLE "shelter_resources"
  ADD CONSTRAINT "shelter_resources_quantity_nonneg" CHECK ("quantity" >= 0);

ALTER TABLE "incidents"
  ADD CONSTRAINT "incidents_latitude_range"   CHECK ("latitude"  IS NULL OR "latitude"  BETWEEN -90  AND 90),
  ADD CONSTRAINT "incidents_longitude_range"  CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
  ADD CONSTRAINT "incidents_coords_paired"    CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
  ADD CONSTRAINT "incidents_has_location"     CHECK ("latitude" IS NOT NULL OR "location_text" IS NOT NULL),
  ADD CONSTRAINT "incidents_priority_range"   CHECK ("priority_score" BETWEEN 0 AND 100),
  ADD CONSTRAINT "incidents_sync_source"      CHECK ("sync_source" IN ('DIRECT', 'SYNC'));

ALTER TABLE "alerts"
  ADD CONSTRAINT "alerts_expiry_after_start"  CHECK ("expires_at" > "starts_at");

ALTER TABLE "user_safety_status"
  ADD CONSTRAINT "user_safety_status_owner"   CHECK ("user_id" IS NOT NULL OR "device_id" IS NOT NULL);
