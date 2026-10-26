CREATE TYPE "GpsPointSource" AS ENUM ('MACHINE', 'WORKER_PHONE');

CREATE TYPE "MachinePresenceSource" AS ENUM ('MACHINE_GPS', 'WORKER_PHONE', 'MANUAL', 'SYSTEM');

ALTER TABLE "CompanyProfile"
ADD COLUMN "fleetGpsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "workerPhoneGpsEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Machine"
ADD COLUMN "gpsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "gpsDeviceId" TEXT,
ADD COLUMN "lastGpsLat" DECIMAL(10,7),
ADD COLUMN "lastGpsLng" DECIMAL(10,7),
ADD COLUMN "lastGpsAt" TIMESTAMP(3);

CREATE TABLE "WorkSessionPauseInterval" (
    "id" TEXT NOT NULL,
    "workSessionId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSessionPauseInterval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GpsLocationPoint" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "machineId" TEXT,
    "workerId" TEXT,
    "workSessionId" TEXT,
    "baustelleId" TEXT,
    "source" "GpsPointSource" NOT NULL,
    "lat" DECIMAL(10,7) NOT NULL,
    "lng" DECIMAL(10,7) NOT NULL,
    "accuracyMeters" DECIMAL(10,2),
    "speedKmh" DECIMAL(10,2),
    "headingDeg" DECIMAL(10,2),
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GpsLocationPoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MachineBaustellePresence" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "baustelleId" TEXT NOT NULL,
    "workSessionId" TEXT,
    "source" "MachinePresenceSource" NOT NULL DEFAULT 'MACHINE_GPS',
    "enteredAt" TIMESTAMP(3) NOT NULL,
    "leftAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "routePointCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MachineBaustellePresence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkSessionPauseInterval_workSessionId_startedAt_idx" ON "WorkSessionPauseInterval"("workSessionId", "startedAt");
CREATE INDEX "WorkSessionPauseInterval_workerId_startedAt_idx" ON "WorkSessionPauseInterval"("workerId", "startedAt");

CREATE UNIQUE INDEX "Machine_gpsDeviceId_key" ON "Machine"("gpsDeviceId");
CREATE INDEX "Machine_companyProfileId_gpsEnabled_lastGpsAt_idx" ON "Machine"("companyProfileId", "gpsEnabled", "lastGpsAt");

CREATE INDEX "GpsLocationPoint_companyProfileId_recordedAt_idx" ON "GpsLocationPoint"("companyProfileId", "recordedAt");
CREATE INDEX "GpsLocationPoint_machineId_recordedAt_idx" ON "GpsLocationPoint"("machineId", "recordedAt");
CREATE INDEX "GpsLocationPoint_workerId_recordedAt_idx" ON "GpsLocationPoint"("workerId", "recordedAt");
CREATE INDEX "GpsLocationPoint_workSessionId_recordedAt_idx" ON "GpsLocationPoint"("workSessionId", "recordedAt");
CREATE INDEX "GpsLocationPoint_baustelleId_recordedAt_idx" ON "GpsLocationPoint"("baustelleId", "recordedAt");

CREATE INDEX "MachineBaustellePresence_companyProfileId_enteredAt_idx" ON "MachineBaustellePresence"("companyProfileId", "enteredAt");
CREATE INDEX "MachineBaustellePresence_machineId_enteredAt_idx" ON "MachineBaustellePresence"("machineId", "enteredAt");
CREATE INDEX "MachineBaustellePresence_baustelleId_enteredAt_idx" ON "MachineBaustellePresence"("baustelleId", "enteredAt");
CREATE INDEX "MachineBaustellePresence_workSessionId_idx" ON "MachineBaustellePresence"("workSessionId");

ALTER TABLE "WorkSessionPauseInterval"
ADD CONSTRAINT "WorkSessionPauseInterval_workSessionId_fkey"
FOREIGN KEY ("workSessionId") REFERENCES "WorkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkSessionPauseInterval"
ADD CONSTRAINT "WorkSessionPauseInterval_workerId_fkey"
FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GpsLocationPoint"
ADD CONSTRAINT "GpsLocationPoint_companyProfileId_fkey"
FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GpsLocationPoint"
ADD CONSTRAINT "GpsLocationPoint_machineId_fkey"
FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GpsLocationPoint"
ADD CONSTRAINT "GpsLocationPoint_workerId_fkey"
FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GpsLocationPoint"
ADD CONSTRAINT "GpsLocationPoint_workSessionId_fkey"
FOREIGN KEY ("workSessionId") REFERENCES "WorkSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GpsLocationPoint"
ADD CONSTRAINT "GpsLocationPoint_baustelleId_fkey"
FOREIGN KEY ("baustelleId") REFERENCES "Baustelle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MachineBaustellePresence"
ADD CONSTRAINT "MachineBaustellePresence_companyProfileId_fkey"
FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MachineBaustellePresence"
ADD CONSTRAINT "MachineBaustellePresence_machineId_fkey"
FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MachineBaustellePresence"
ADD CONSTRAINT "MachineBaustellePresence_baustelleId_fkey"
FOREIGN KEY ("baustelleId") REFERENCES "Baustelle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MachineBaustellePresence"
ADD CONSTRAINT "MachineBaustellePresence_workSessionId_fkey"
FOREIGN KEY ("workSessionId") REFERENCES "WorkSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
