-- Customer sales orders are additive; existing inventory and business records are preserved.
CREATE TYPE "CustomerOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'FULFILLED', 'CANCELLED');
CREATE TYPE "ReservationReleaseReason" AS ENUM ('FULFILLED', 'CANCELLED');

ALTER TABLE "StockMovement" ADD COLUMN "customerOrderId" TEXT;

CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "city" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "CustomerOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "expectedFulfillmentAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    CONSTRAINT "CustomerOrder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CustomerOrder_status_timestamps_valid" CHECK (
        ("status" = 'DRAFT' AND "confirmedAt" IS NULL AND "fulfilledAt" IS NULL AND "cancelledAt" IS NULL) OR
        ("status" = 'CONFIRMED' AND "confirmedAt" IS NOT NULL AND "fulfilledAt" IS NULL AND "cancelledAt" IS NULL) OR
        ("status" = 'FULFILLED' AND "confirmedAt" IS NOT NULL AND "fulfilledAt" IS NOT NULL AND "cancelledAt" IS NULL) OR
        ("status" = 'CANCELLED' AND "fulfilledAt" IS NULL AND "cancelledAt" IS NOT NULL)
    )
);

CREATE SEQUENCE "CustomerOrder_orderNumber_seq" START WITH 1 INCREMENT BY 1 NO CYCLE;

CREATE TABLE "CustomerOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "orderedQuantity" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerOrderLine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CustomerOrderLine_orderedQuantity_valid" CHECK (
        "orderedQuantity" > 0 AND "orderedQuantity" <= 1000000000
    )
);

CREATE TABLE "CustomerOrderReservation" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "releaseReason" "ReservationReleaseReason",
    CONSTRAINT "CustomerOrderReservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CustomerOrderReservation_quantity_valid" CHECK (
        "quantity" > 0 AND "quantity" <= 1000000000
    ),
    CONSTRAINT "CustomerOrderReservation_release_valid" CHECK (
        ("releasedAt" IS NULL AND "releaseReason" IS NULL) OR
        ("releasedAt" IS NOT NULL AND "releaseReason" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "CustomerOrder_orderNumber_key" ON "CustomerOrder"("orderNumber");
CREATE UNIQUE INDEX "CustomerOrder_createdByUserId_idempotencyKey_key" ON "CustomerOrder"("createdByUserId", "idempotencyKey");
CREATE INDEX "CustomerOrder_customerId_createdAt_idx" ON "CustomerOrder"("customerId", "createdAt");
CREATE INDEX "CustomerOrder_status_createdAt_idx" ON "CustomerOrder"("status", "createdAt");
CREATE INDEX "Customer_name_idx" ON "Customer"("name");
CREATE INDEX "Customer_isActive_name_idx" ON "Customer"("isActive", "name");
CREATE UNIQUE INDEX "CustomerOrderLine_orderId_productId_key" ON "CustomerOrderLine"("orderId", "productId");
CREATE INDEX "CustomerOrderLine_productId_idx" ON "CustomerOrderLine"("productId");
CREATE UNIQUE INDEX "CustomerOrderReservation_orderLineId_key" ON "CustomerOrderReservation"("orderLineId");
CREATE INDEX "CustomerOrderReservation_productId_releasedAt_idx" ON "CustomerOrderReservation"("productId", "releasedAt");
CREATE INDEX "CustomerOrderReservation_orderId_releasedAt_idx" ON "CustomerOrderReservation"("orderId", "releasedAt");
CREATE UNIQUE INDEX "StockMovement_customerOrderId_productId_type_key" ON "StockMovement"("customerOrderId", "productId", "type");
CREATE INDEX "StockMovement_customerOrderId_idx" ON "StockMovement"("customerOrderId");

ALTER TABLE "CustomerOrder" ADD CONSTRAINT "CustomerOrder_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerOrder" ADD CONSTRAINT "CustomerOrder_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerOrderLine" ADD CONSTRAINT "CustomerOrderLine_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "CustomerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerOrderLine" ADD CONSTRAINT "CustomerOrderLine_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerOrderReservation" ADD CONSTRAINT "CustomerOrderReservation_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "CustomerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerOrderReservation" ADD CONSTRAINT "CustomerOrderReservation_orderLineId_fkey"
    FOREIGN KEY ("orderLineId") REFERENCES "CustomerOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerOrderReservation" ADD CONSTRAINT "CustomerOrderReservation_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_customerOrderId_fkey"
    FOREIGN KEY ("customerOrderId") REFERENCES "CustomerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
