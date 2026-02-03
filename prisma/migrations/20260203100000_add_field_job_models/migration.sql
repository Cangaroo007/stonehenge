-- CreateEnum
CREATE TYPE "FieldJobStatus" AS ENUM ('IN_PROGRESS', 'READY_FOR_QUOTE', 'CONVERTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "FieldJob" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "siteAddress" TEXT,
    "contactPhone" TEXT,
    "status" "FieldJobStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "notes" TEXT,
    "quoteId" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "FieldJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldPhoto" (
    "id" TEXT NOT NULL,
    "fieldJobId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "caption" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldMeasurement" (
    "id" TEXT NOT NULL,
    "fieldJobId" TEXT NOT NULL,
    "room" TEXT,
    "piece" TEXT,
    "length" DECIMAL(10,2) NOT NULL,
    "width" DECIMAL(10,2) NOT NULL,
    "thickness" INTEGER NOT NULL DEFAULT 20,
    "finishedEdges" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FieldJob_quoteId_key" ON "FieldJob"("quoteId");

-- CreateIndex
CREATE INDEX "FieldJob_createdBy_idx" ON "FieldJob"("createdBy");

-- CreateIndex
CREATE INDEX "FieldJob_status_idx" ON "FieldJob"("status");

-- CreateIndex
CREATE INDEX "FieldPhoto_fieldJobId_idx" ON "FieldPhoto"("fieldJobId");

-- CreateIndex
CREATE INDEX "FieldMeasurement_fieldJobId_idx" ON "FieldMeasurement"("fieldJobId");

-- AddForeignKey
ALTER TABLE "FieldJob" ADD CONSTRAINT "FieldJob_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldPhoto" ADD CONSTRAINT "FieldPhoto_fieldJobId_fkey" FOREIGN KEY ("fieldJobId") REFERENCES "FieldJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldMeasurement" ADD CONSTRAINT "FieldMeasurement_fieldJobId_fkey" FOREIGN KEY ("fieldJobId") REFERENCES "FieldJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
