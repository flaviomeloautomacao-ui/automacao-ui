-- B.2 — Add structured Process Data fields (Temperature, Pressure, Volume)
-- to area spreadsheet rows and area report sources. Previously these values
-- were concatenated as plain text into `observacoes`; this migration moves them
-- to first-class columns so the PDF template can render dedicated columns.

ALTER TABLE "area_spreadsheet_rows"
  ADD COLUMN "temperatura_processo" TEXT,
  ADD COLUMN "pressao_processo" TEXT,
  ADD COLUMN "volume_processo" TEXT;

ALTER TABLE "area_report_sources"
  ADD COLUMN "temperatura_processo" TEXT,
  ADD COLUMN "pressao_processo" TEXT,
  ADD COLUMN "volume_processo" TEXT;
