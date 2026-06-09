-- Phase 2: Areas-flow expansion (Project-Explo template support)
-- Date: 2026-04-29

-- ─── Report: campos extras para o template de Áreas ────────────
ALTER TABLE "reports"
  ADD COLUMN "escopo_complementar"    TEXT,
  ADD COLUMN "tipo_unidade"           TEXT,
  ADD COLUMN "equipe_responsavel"     JSONB,
  ADD COLUMN "equipe_project_explo"   JSONB,
  ADD COLUMN "art_pdf_url"            TEXT;

-- ─── AreaReportArea: descrição da área ─────────────────────────
ALTER TABLE "area_report_areas"
  ADD COLUMN "description" TEXT;

-- ─── AreaReportAreaImage: fotos por área ───────────────────────
CREATE TABLE "area_report_area_images" (
    "id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "public_id" TEXT NOT NULL,
    "secure_url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "caption" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "area_report_area_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "area_report_area_images_area_id_idx"
  ON "area_report_area_images"("area_id");

ALTER TABLE "area_report_area_images"
  ADD CONSTRAINT "area_report_area_images_area_id_fkey"
  FOREIGN KEY ("area_id") REFERENCES "area_report_areas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── AreaReportSubstance: campos físico-químicos (Tabela 1) ────
ALTER TABLE "area_report_substances"
  ADD COLUMN "tipo"                TEXT,
  ADD COLUMN "ponto_fulgor"        TEXT,
  ADD COLUMN "lii"                 TEXT,
  ADD COLUMN "densidade_relativa"  TEXT,
  ADD COLUMN "tai"                 TEXT,
  ADD COLUMN "cme"                 TEXT,
  ADD COLUMN "mit"                 TEXT,
  ADD COLUMN "sit_camada"          TEXT,
  ADD COLUMN "tmax"                TEXT,
  ADD COLUMN "st"                  TEXT,
  ADD COLUMN "legend_notes"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
