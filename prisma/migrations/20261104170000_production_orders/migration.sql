-- Prisma schema does not yet support CHECK constraints; keep these database invariants here.
-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "BillOfMaterials"
    ADD COLUMN "finishedProductName" TEXT,
    ADD COLUMN "finishedProductSku" TEXT,
    ADD COLUMN "finishedProductUnit" TEXT;

-- Backfill snapshots for all BOM revisions created before this migration.
UPDATE "BillOfMaterials" AS bom
SET "finishedProductName" = product."name",
    "finishedProductSku" = product."sku",
    "finishedProductUnit" = product."unit"
FROM "Product" AS product
WHERE product."id" = bom."finishedProductId";

ALTER TABLE "BillOfMaterials"
    ALTER COLUMN "finishedProductName" SET NOT NULL,
    ALTER COLUMN "finishedProductSku" SET NOT NULL,
    ALTER COLUMN "finishedProductUnit" SET NOT NULL;

-- CreateTable
CREATE TABLE "ProductionOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "bomId" TEXT NOT NULL,
    "plannedQuantity" DECIMAL(18,6) NOT NULL,
    "producedQuantity" DECIMAL(18,6),
    "plannedStartDate" TIMESTAMP(3),
    "expectedCompletionDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductionOrder_plannedQuantity_positive" CHECK ("plannedQuantity" > 0),
    CONSTRAINT "ProductionOrder_producedQuantity_valid" CHECK (
        "producedQuantity" IS NULL OR
        ("producedQuantity" > 0 AND "producedQuantity" <= "plannedQuantity")
    ),
    CONSTRAINT "ProductionOrder_dates_valid" CHECK (
        "plannedStartDate" IS NULL OR "expectedCompletionDate" IS NULL OR
        "expectedCompletionDate" >= "plannedStartDate"
    )
);

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "productionOrderId" TEXT;

-- CreateSequence
CREATE SEQUENCE "ProductionOrder_orderNumber_seq"
    START WITH 1
    INCREMENT BY 1
    NO CYCLE;

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_orderNumber_key" ON "ProductionOrder"("orderNumber");
CREATE INDEX "ProductionOrder_status_createdAt_idx" ON "ProductionOrder"("status", "createdAt");
CREATE INDEX "ProductionOrder_bomId_createdAt_idx" ON "ProductionOrder"("bomId", "createdAt");
CREATE INDEX "StockMovement_productionOrderId_idx" ON "StockMovement"("productionOrderId");
CREATE UNIQUE INDEX "StockMovement_productionOrderId_productId_type_key"
    ON "StockMovement"("productionOrderId", "productId", "type");

-- AddForeignKey
ALTER TABLE "ProductionOrder"
    ADD CONSTRAINT "ProductionOrder_bomId_fkey"
    FOREIGN KEY ("bomId") REFERENCES "BillOfMaterials"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_productionOrderId_fkey"
    FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
