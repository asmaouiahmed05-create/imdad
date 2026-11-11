CREATE TYPE "DeliveryShipmentStatus" AS ENUM (
    'PREPARING',
    'READY_FOR_DISPATCH',
    'DISPATCHED',
    'IN_TRANSIT',
    'DELIVERED',
    'DELIVERY_FAILED'
);
CREATE TYPE "DeliveryRunStatus" AS ENUM (
    'PLANNED',
    'DISPATCHED',
    'COMPLETED',
    'CANCELLED'
);
CREATE TYPE "DeliveryPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "DeliveryVehicleType" AS ENUM ('VAN', 'TRUCK', 'REFRIGERATED', 'OTHER');
CREATE TYPE "DeliveryEventType" AS ENUM (
    'CREATED',
    'STATUS_CHANGED',
    'ASSIGNED_TO_RUN',
    'RESCHEDULED',
    'RUN_DISPATCHED'
);

CREATE TABLE "DeliveryDriver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeliveryDriver_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryVehicle" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "DeliveryVehicleType" NOT NULL,
    "maxStops" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeliveryVehicle_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DeliveryVehicle_maxStops_valid" CHECK ("maxStops" > 0 AND "maxStops" <= 200)
);

CREATE TABLE "DeliveryRun" (
    "id" TEXT NOT NULL,
    "runNumber" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "priority" "DeliveryPriority" NOT NULL DEFAULT 'NORMAL',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "DeliveryRunStatus" NOT NULL DEFAULT 'PLANNED',
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "dispatchedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeliveryRun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DeliveryRun_status_timestamps_valid" CHECK (
        ("status" = 'PLANNED' AND "dispatchedAt" IS NULL AND "completedAt" IS NULL) OR
        ("status" = 'DISPATCHED' AND "dispatchedAt" IS NOT NULL AND "completedAt" IS NULL) OR
        ("status" = 'COMPLETED' AND "dispatchedAt" IS NOT NULL AND "completedAt" IS NOT NULL) OR
        ("status" = 'CANCELLED' AND "completedAt" IS NULL)
    )
);

CREATE TABLE "DeliveryShipment" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "DeliveryShipmentStatus" NOT NULL DEFAULT 'PREPARING',
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "region" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "expectedDeliveryAt" TIMESTAMP(3) NOT NULL,
    "runId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "receiverName" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "failedReason" TEXT,
    "notes" TEXT,
    "readyAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "inTransitAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeliveryShipment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DeliveryShipment_address_valid" CHECK (length(btrim("address")) > 0 AND length("address") <= 300),
    CONSTRAINT "DeliveryShipment_status_timestamps_valid" CHECK (
        ("status" <> 'READY_FOR_DISPATCH' OR "readyAt" IS NOT NULL) AND
        ("status" NOT IN ('DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'DELIVERY_FAILED') OR "dispatchedAt" IS NOT NULL) AND
        ("status" <> 'IN_TRANSIT' OR "inTransitAt" IS NOT NULL) AND
        ("status" <> 'DELIVERED' OR ("deliveredAt" IS NOT NULL AND "receiverName" IS NOT NULL)) AND
        ("status" <> 'DELIVERY_FAILED' OR ("failedAt" IS NOT NULL AND "failedReason" IS NOT NULL))
    )
);

CREATE TABLE "DeliveryEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "type" "DeliveryEventType" NOT NULL,
    "fromStatus" "DeliveryShipmentStatus",
    "toStatus" "DeliveryShipmentStatus",
    "runId" TEXT,
    "reason" TEXT,
    "receiverName" TEXT,
    "expectedDeliveryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeliveryEvent_pkey" PRIMARY KEY ("id")
);

CREATE SEQUENCE "DeliveryRun_runNumber_seq" START WITH 1 INCREMENT BY 1 NO CYCLE;
CREATE SEQUENCE "DeliveryShipment_reference_seq" START WITH 1 INCREMENT BY 1 NO CYCLE;

CREATE UNIQUE INDEX "DeliveryVehicle_plate_key" ON "DeliveryVehicle"("plate");
CREATE INDEX "DeliveryDriver_isActive_name_idx" ON "DeliveryDriver"("isActive", "name");
CREATE INDEX "DeliveryVehicle_isActive_plate_idx" ON "DeliveryVehicle"("isActive", "plate");
CREATE UNIQUE INDEX "DeliveryRun_runNumber_key" ON "DeliveryRun"("runNumber");
CREATE INDEX "DeliveryRun_status_scheduledAt_idx" ON "DeliveryRun"("status", "scheduledAt");
CREATE INDEX "DeliveryRun_driverId_scheduledAt_idx" ON "DeliveryRun"("driverId", "scheduledAt");
CREATE INDEX "DeliveryRun_vehicleId_scheduledAt_idx" ON "DeliveryRun"("vehicleId", "scheduledAt");
CREATE UNIQUE INDEX "DeliveryShipment_reference_key" ON "DeliveryShipment"("reference");
CREATE UNIQUE INDEX "DeliveryShipment_orderId_key" ON "DeliveryShipment"("orderId");
CREATE INDEX "DeliveryShipment_status_expectedDeliveryAt_idx" ON "DeliveryShipment"("status", "expectedDeliveryAt");
CREATE INDEX "DeliveryShipment_region_status_idx" ON "DeliveryShipment"("region", "status");
CREATE INDEX "DeliveryShipment_runId_status_idx" ON "DeliveryShipment"("runId", "status");
CREATE INDEX "DeliveryEvent_shipmentId_createdAt_idx" ON "DeliveryEvent"("shipmentId", "createdAt");
CREATE INDEX "DeliveryEvent_actorUserId_createdAt_idx" ON "DeliveryEvent"("actorUserId", "createdAt");
CREATE INDEX "DeliveryEvent_runId_createdAt_idx" ON "DeliveryEvent"("runId", "createdAt");

ALTER TABLE "DeliveryRun" ADD CONSTRAINT "DeliveryRun_driverId_fkey"
    FOREIGN KEY ("driverId") REFERENCES "DeliveryDriver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryRun" ADD CONSTRAINT "DeliveryRun_vehicleId_fkey"
    FOREIGN KEY ("vehicleId") REFERENCES "DeliveryVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryRun" ADD CONSTRAINT "DeliveryRun_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryShipment" ADD CONSTRAINT "DeliveryShipment_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "CustomerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryShipment" ADD CONSTRAINT "DeliveryShipment_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "DeliveryRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryShipment" ADD CONSTRAINT "DeliveryShipment_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryEvent" ADD CONSTRAINT "DeliveryEvent_shipmentId_fkey"
    FOREIGN KEY ("shipmentId") REFERENCES "DeliveryShipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryEvent" ADD CONSTRAINT "DeliveryEvent_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryEvent" ADD CONSTRAINT "DeliveryEvent_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "DeliveryRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
