-- CreateEnum
CREATE TYPE "ProductClassification" AS ENUM ('UNCLASSIFIED', 'MATERIAL', 'FINISHED_GOOD', 'BOTH');

-- CreateEnum
CREATE TYPE "BillOfMaterialsStatus" AS ENUM ('DRAFT', 'RELEASED', 'RETIRED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "classification" "ProductClassification" NOT NULL DEFAULT 'UNCLASSIFIED';

-- CreateTable
CREATE TABLE "BillOfMaterials" (
    "id" TEXT NOT NULL,
    "finishedProductId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "BillOfMaterialsStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "BillOfMaterials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillOfMaterials_revision_positive" CHECK ("revision" > 0)
);

-- CreateTable
CREATE TABLE "BillOfMaterialsComponent" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "materialProductId" TEXT NOT NULL,
    "quantityPerUnit" DECIMAL(18,6) NOT NULL,
    "materialName" TEXT NOT NULL,
    "materialSku" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillOfMaterialsComponent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillOfMaterialsComponent_quantity_positive" CHECK ("quantityPerUnit" > 0)
);

-- CreateIndex
CREATE INDEX "BillOfMaterials_finishedProductId_status_revision_idx" ON "BillOfMaterials"("finishedProductId", "status", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "BillOfMaterials_finishedProductId_revision_key" ON "BillOfMaterials"("finishedProductId", "revision");

-- CreateIndex
CREATE INDEX "BillOfMaterialsComponent_materialProductId_idx" ON "BillOfMaterialsComponent"("materialProductId");

-- CreateIndex
CREATE UNIQUE INDEX "BillOfMaterialsComponent_bomId_materialProductId_key" ON "BillOfMaterialsComponent"("bomId", "materialProductId");

-- CreateIndex
CREATE INDEX "Product_classification_name_idx" ON "Product"("classification", "name");

-- AddForeignKey
ALTER TABLE "BillOfMaterials" ADD CONSTRAINT "BillOfMaterials_finishedProductId_fkey" FOREIGN KEY ("finishedProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillOfMaterialsComponent" ADD CONSTRAINT "BillOfMaterialsComponent_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "BillOfMaterials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillOfMaterialsComponent" ADD CONSTRAINT "BillOfMaterialsComponent_materialProductId_fkey" FOREIGN KEY ("materialProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
