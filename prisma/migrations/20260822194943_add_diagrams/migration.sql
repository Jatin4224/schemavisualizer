-- CreateTable
CREATE TABLE "diagram" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "viewportX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "viewportY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "viewportZoom" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagramEntity" (
    "id" TEXT NOT NULL,
    "diagramId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "color" TEXT,
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "collapsed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "diagramEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagramEntityField" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isUnique" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "diagramEntityField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagramRelation" (
    "id" TEXT NOT NULL,
    "diagramId" TEXT NOT NULL,
    "fromEntityId" TEXT NOT NULL,
    "fromFieldId" TEXT,
    "toEntityId" TEXT NOT NULL,
    "toFieldId" TEXT,
    "cardinality" TEXT NOT NULL,
    "onDelete" TEXT NOT NULL DEFAULT 'restrict',
    "label" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "diagramRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagramSnapshot" (
    "id" TEXT NOT NULL,
    "diagramId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagramSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diagram_organizationId_idx" ON "diagram"("organizationId");

-- CreateIndex
CREATE INDEX "diagram_createdById_idx" ON "diagram"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "diagram_organizationId_name_key" ON "diagram"("organizationId", "name");

-- CreateIndex
CREATE INDEX "diagramEntity_diagramId_idx" ON "diagramEntity"("diagramId");

-- CreateIndex
CREATE UNIQUE INDEX "diagramEntity_diagramId_name_key" ON "diagramEntity"("diagramId", "name");

-- CreateIndex
CREATE INDEX "diagramEntityField_entityId_idx" ON "diagramEntityField"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "diagramEntityField_entityId_name_key" ON "diagramEntityField"("entityId", "name");

-- CreateIndex
CREATE INDEX "diagramRelation_diagramId_idx" ON "diagramRelation"("diagramId");

-- CreateIndex
CREATE INDEX "diagramSnapshot_diagramId_idx" ON "diagramSnapshot"("diagramId");

-- CreateIndex
CREATE INDEX "diagramSnapshot_createdById_idx" ON "diagramSnapshot"("createdById");

-- AddForeignKey
ALTER TABLE "diagram" ADD CONSTRAINT "diagram_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagram" ADD CONSTRAINT "diagram_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagramEntity" ADD CONSTRAINT "diagramEntity_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "diagram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagramEntityField" ADD CONSTRAINT "diagramEntityField_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "diagramEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagramRelation" ADD CONSTRAINT "diagramRelation_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "diagram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagramSnapshot" ADD CONSTRAINT "diagramSnapshot_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "diagram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagramSnapshot" ADD CONSTRAINT "diagramSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
