-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('dha', 'areas');

-- CreateEnum
CREATE TYPE "DocumentSchemaVersion" AS ENUM ('legacy', 'v2');

-- AlterTable
ALTER TABLE "jobs"
ADD COLUMN "document_schema_version" "DocumentSchemaVersion" NOT NULL DEFAULT 'legacy',
ADD COLUMN "document_type" "DocumentType";

-- CreateTable
CREATE TABLE "dha_spreadsheet_uploads" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "row_count" INTEGER NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dha_spreadsheet_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dha_spreadsheet_rows" (
    "id" UUID NOT NULL,
    "upload_id" UUID NOT NULL,
    "row_index" INTEGER NOT NULL,
    "equipment_name" TEXT,
    "equipment_description" TEXT,
    "raw_json" JSONB NOT NULL,
    "normalized_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dha_spreadsheet_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dha_report_equipments" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "equipment_name" TEXT NOT NULL,
    "equipment_description" TEXT,
    "order_index" INTEGER NOT NULL,
    "local_instalacao" TEXT,
    "funcao_operacional" TEXT,
    "observacoes_extras" TEXT,
    "extra_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dha_report_equipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dha_equipment_images" (
    "id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "public_id" TEXT NOT NULL,
    "secure_url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dha_equipment_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "area_spreadsheet_uploads" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "row_count" INTEGER NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "area_spreadsheet_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "area_spreadsheet_rows" (
    "id" UUID NOT NULL,
    "upload_id" UUID NOT NULL,
    "row_index" INTEGER NOT NULL,
    "area_local" TEXT NOT NULL,
    "tag_referencia" TEXT,
    "substancia" TEXT NOT NULL,
    "fonte_liberacao" TEXT NOT NULL,
    "grau_liberacao" TEXT NOT NULL,
    "ventilacao_tipo" TEXT NOT NULL,
    "grau_ventilacao" TEXT NOT NULL,
    "disponibilidade_ventilacao" TEXT NOT NULL,
    "zona" TEXT NOT NULL,
    "extensao" TEXT NOT NULL,
    "grupo" TEXT,
    "classe_temperatura" TEXT,
    "epl" TEXT,
    "observacoes" TEXT,
    "raw_json" JSONB NOT NULL,
    "normalized_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "area_spreadsheet_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "area_report_areas" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "area_name" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "operational_notes" TEXT,
    "ventilation_premises" TEXT,
    "extra_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "area_report_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "area_report_sources" (
    "id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL,
    "tag_referencia" TEXT,
    "substance_name" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "liberation_degree" TEXT NOT NULL,
    "ventilation_type" TEXT NOT NULL,
    "ventilation_degree" TEXT NOT NULL,
    "ventilation_availability" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "grupo" TEXT,
    "classe_temperatura" TEXT,
    "epl" TEXT,
    "notes" TEXT,
    "extra_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "area_report_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "area_report_substances" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "substance_name" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "grupo" TEXT,
    "classe_temperatura" TEXT,
    "epl" TEXT,
    "properties_json" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "area_report_substances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "area_reference_documents" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "document_code" TEXT,
    "document_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "area_reference_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dha_spreadsheet_uploads_job_id_key" ON "dha_spreadsheet_uploads"("job_id");

-- CreateIndex
CREATE INDEX "dha_spreadsheet_rows_upload_id_idx" ON "dha_spreadsheet_rows"("upload_id");

-- CreateIndex
CREATE INDEX "dha_report_equipments_report_id_idx" ON "dha_report_equipments"("report_id");

-- CreateIndex
CREATE INDEX "dha_equipment_images_equipment_id_idx" ON "dha_equipment_images"("equipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "area_spreadsheet_uploads_job_id_key" ON "area_spreadsheet_uploads"("job_id");

-- CreateIndex
CREATE INDEX "area_spreadsheet_rows_upload_id_idx" ON "area_spreadsheet_rows"("upload_id");

-- CreateIndex
CREATE INDEX "area_report_areas_report_id_idx" ON "area_report_areas"("report_id");

-- CreateIndex
CREATE INDEX "area_report_sources_area_id_idx" ON "area_report_sources"("area_id");

-- CreateIndex
CREATE INDEX "area_report_substances_report_id_idx" ON "area_report_substances"("report_id");

-- CreateIndex
CREATE INDEX "area_reference_documents_report_id_idx" ON "area_reference_documents"("report_id");

-- AddForeignKey
ALTER TABLE "dha_spreadsheet_uploads" ADD CONSTRAINT "dha_spreadsheet_uploads_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dha_spreadsheet_rows" ADD CONSTRAINT "dha_spreadsheet_rows_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "dha_spreadsheet_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dha_report_equipments" ADD CONSTRAINT "dha_report_equipments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dha_equipment_images" ADD CONSTRAINT "dha_equipment_images_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "dha_report_equipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "area_spreadsheet_uploads" ADD CONSTRAINT "area_spreadsheet_uploads_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "area_spreadsheet_rows" ADD CONSTRAINT "area_spreadsheet_rows_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "area_spreadsheet_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "area_report_areas" ADD CONSTRAINT "area_report_areas_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "area_report_sources" ADD CONSTRAINT "area_report_sources_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area_report_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "area_report_substances" ADD CONSTRAINT "area_report_substances_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "area_reference_documents" ADD CONSTRAINT "area_reference_documents_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
