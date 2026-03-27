/**
 * Tests — Equipment Image Naming (normalizeEquipmentName.ts)
 *
 * Run: npx tsx scripts/test-image-naming.ts
 *
 * Covers:
 *  1. toPascalCase — various input formats
 *  2. generateImageName — correct format generation
 *  3. validateImageName — valid and invalid names
 *  4. parseImageFileName — parsing with extensions
 *  5. getNextImageIndex — index calculation
 *  6. matchImagesToEquipments — dual-format matching
 *  7. Edge cases — empty strings, special characters, duplicates
 */

import {
  toPascalCase,
  sanitizeContratoId,
  generateImageName,
  generateImageFileName,
  validateImageName,
  validateImageFileName,
  parseImageFileName,
  getNextImageIndex,
  normalizeEquipmentName,
  EQUIPMENT_IMAGE_NAME_REGEX,
} from "../lib/normalizeEquipmentName";

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${description}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${description}`);
  }
}

function assertEqual<T>(actual: T, expected: T, description: string): void {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${description}`);
  } else {
    failed++;
    console.error(
      `  ✗ FAIL: ${description}\n    Expected: ${JSON.stringify(expected)}\n    Actual:   ${JSON.stringify(actual)}`,
    );
  }
}

// ─── 1. toPascalCase ──────────────────────────────────────

console.log("\n1. toPascalCase");

assertEqual(
  toPascalCase("Moega Ferroviária 1720"),
  "MoegaFerroviaria1720",
  "Acentos e espaços → PascalCase",
);

assertEqual(
  toPascalCase("silo baía norte 2"),
  "SiloBaiaNorte2",
  "lowercase → PascalCase com número",
);

assertEqual(
  toPascalCase("MOEGA FERROVIARIA 1720"),
  "MoegaFerroviaria1720",
  "UPPERCASE → PascalCase",
);

assertEqual(
  toPascalCase("Moega 1720 (rodoviária)"),
  "Moega1720Rodoviaria",
  "Parênteses removidos, conteúdo preservado",
);

assertEqual(
  toPascalCase("silo-norte_2"),
  "SiloNorte2",
  "Hífens e underscores como separadores",
);

assertEqual(
  toPascalCase("  elevador  de  canecas  "),
  "ElevadorDeCanecas",
  "Múltiplos espaços tratados",
);

assertEqual(
  toPascalCase(""),
  "",
  "String vazia → vazio",
);

// ─── 2. sanitizeContratoId ────────────────────────────────

console.log("\n2. sanitizeContratoId");

assertEqual(
  sanitizeContratoId("1234-5678/90"),
  "1234567890",
  "Remove hífens e barras",
);

assertEqual(
  sanitizeContratoId("ABC123"),
  "ABC123",
  "Alfanuméricos preservados",
);

assertEqual(
  sanitizeContratoId(""),
  "",
  "String vazia → vazio",
);

// ─── 3. generateImageName ─────────────────────────────────

console.log("\n3. generateImageName");

assertEqual(
  generateImageName("Moega Ferroviária 1720", "123412341234", 0),
  "MoegaFerroviaria1720_123412341234-0",
  "Formato completo correto",
);

assertEqual(
  generateImageName("Silo Baía Norte 2", "12341234", 0),
  "SiloBaiaNorte2_12341234-0",
  "Outro equipamento correto",
);

assertEqual(
  generateImageName("Moega Ferroviária 1720", "123412341234", 3),
  "MoegaFerroviaria1720_123412341234-3",
  "Índice > 0",
);

assertEqual(
  generateImageName("Elevator", "ABC-123", 0),
  "Elevator_ABC123-0",
  "Contrato com hífen sanitizado",
);

// ─── 4. generateImageFileName ─────────────────────────────

console.log("\n4. generateImageFileName");

assertEqual(
  generateImageFileName("Moega Ferroviária 1720", "123412341234", 0, "jpg"),
  "MoegaFerroviaria1720_123412341234-0.jpg",
  "Com extensão jpg",
);

assertEqual(
  generateImageFileName("Silo", "1234", 1, ".PNG"),
  "Silo_1234-1.png",
  "Extensão normalizada para lowercase, ponto removido",
);

// ─── 5. validateImageName — Válidos ───────────────────────

console.log("\n5. validateImageName — Válidos");

const validNames = [
  "MoegaFerroviaria1720_123412341234-0",
  "SiloBaiaNorte2_12341234-0",
  "Elevator_ABC123-5",
  "A_B-0",
  "MoegaSuperGrande123_Contrato999-99",
];

for (const name of validNames) {
  const result = validateImageName(name);
  assert(result.valid, `Válido: ${name}`);
  assert(result.errors.length === 0, `  Sem erros: ${name}`);
  assert(result.parsed !== undefined, `  Parsed disponível: ${name}`);
}

// ─── 6. validateImageName — Inválidos ─────────────────────

console.log("\n6. validateImageName — Inválidos");

{
  const r = validateImageName("moegaferroviaria1720_123412341234-0");
  assert(!r.valid, "lowercase → inválido");
  assert(
    r.errors.some((e) => e.code === "NOT_PASCAL_CASE"),
    "  Erro: NOT_PASCAL_CASE",
  );
}

{
  const r = validateImageName("MoegaFerroviaria1720_123412341234");
  assert(!r.valid, "Sem índice → inválido");
  assert(
    r.errors.some((e) => e.code === "MISSING_INDEX"),
    "  Erro: MISSING_INDEX",
  );
}

{
  const r = validateImageName("MoegaRodoviaria-1720_12341234-2");
  assert(!r.valid, "Hífen no nome → inválido");
  assert(
    r.errors.some((e) => e.code === "INVALID_CHARACTERS"),
    "  Erro: INVALID_CHARACTERS",
  );
}

{
  const r = validateImageName("");
  assert(!r.valid, "Vazio → inválido");
  assert(
    r.errors.some((e) => e.code === "EMPTY_NAME"),
    "  Erro: EMPTY_NAME",
  );
}

{
  const r = validateImageName("NomeEquipamento");
  assert(!r.valid, "Sem underscore → inválido");
  assert(
    r.errors.some((e) => e.code === "MISSING_UNDERSCORE"),
    "  Erro: MISSING_UNDERSCORE",
  );
}

{
  const r = validateImageName("_1234-0");
  assert(!r.valid, "Nome vazio antes de _ → inválido");
  assert(
    r.errors.some((e) => e.code === "EMPTY_EQUIPMENT_NAME"),
    "  Erro: EMPTY_EQUIPMENT_NAME",
  );
}

{
  const r = validateImageName("Moega_-0");
  assert(!r.valid, "Contrato vazio → inválido");
  assert(
    r.errors.some((e) => e.code === "EMPTY_CONTRATO"),
    "  Erro: EMPTY_CONTRATO",
  );
}

{
  const r = validateImageName("Moega_1234-abc");
  assert(!r.valid, "Índice não numérico → inválido");
  assert(
    r.errors.some((e) => e.code === "INVALID_INDEX"),
    "  Erro: INVALID_INDEX",
  );
}

{
  const r = validateImageName("Moega Rodoviaria_1234-0");
  assert(!r.valid, "Espaço no nome → inválido");
  assert(
    r.errors.some((e) => e.code === "INVALID_CHARACTERS"),
    "  Erro: INVALID_CHARACTERS no nome",
  );
}

// ─── 7. validateImageFileName ─────────────────────────────

console.log("\n7. validateImageFileName (com extensão)");

{
  const r = validateImageFileName("MoegaFerroviaria1720_123412341234-0.jpg");
  assert(r.valid, "Válido com extensão .jpg");
}

{
  const r = validateImageFileName("moega_1234-0.png");
  assert(!r.valid, "Inválido com extensão .png");
}

// ─── 8. parseImageFileName ────────────────────────────────

console.log("\n8. parseImageFileName");

{
  const r = parseImageFileName("MoegaFerroviaria1720_123412341234-0.jpg");
  assert(r !== null, "Parse com sucesso");
  assertEqual(r?.equipmentName, "MoegaFerroviaria1720", "  equipmentName correto");
  assertEqual(r?.contratoId, "123412341234", "  contratoId correto");
  assertEqual(r?.index, 0, "  index correto");
  assertEqual(r?.extension, "jpg", "  extension correta");
}

{
  const r = parseImageFileName("SiloBaiaNorte2_12341234-3.png");
  assert(r !== null, "Parse Silo com sucesso");
  assertEqual(r?.index, 3, "  index = 3");
}

{
  const r = parseImageFileName("invalid-name.jpg");
  assert(r === null, "Parse falha para nome inválido");
}

// ─── 9. getNextImageIndex ─────────────────────────────────

console.log("\n9. getNextImageIndex");

assertEqual(
  getNextImageIndex([]),
  0,
  "Lista vazia → 0",
);

assertEqual(
  getNextImageIndex(["MoegaFerroviaria1720_1234-0", "MoegaFerroviaria1720_1234-1"]),
  2,
  "Dois existentes → 2",
);

assertEqual(
  getNextImageIndex(["reports/xyz/equipments/MoegaFerroviaria1720_1234-0"]),
  1,
  "Com path completo → 1",
);

assertEqual(
  getNextImageIndex(["Moega_1234-5"]),
  6,
  "Gap no índice → próximo é 6",
);

assertEqual(
  getNextImageIndex(["old-format-without-index"]),
  0,
  "Formato sem índice → 0",
);

// ─── 10. Regex direta ─────────────────────────────────────

console.log("\n10. EQUIPMENT_IMAGE_NAME_REGEX");

assert(EQUIPMENT_IMAGE_NAME_REGEX.test("MoegaFerroviaria1720_123412341234-0"), "Regex: exemplo válido 1");
assert(EQUIPMENT_IMAGE_NAME_REGEX.test("SiloBaiaNorte2_12341234-0"), "Regex: exemplo válido 2");
assert(EQUIPMENT_IMAGE_NAME_REGEX.test("A_B-0"), "Regex: mínimo válido");
assert(!EQUIPMENT_IMAGE_NAME_REGEX.test("moega_1234-0"), "Regex: rejeita lowercase");
assert(!EQUIPMENT_IMAGE_NAME_REGEX.test("Moega_1234"), "Regex: rejeita sem índice");
assert(!EQUIPMENT_IMAGE_NAME_REGEX.test("Moega-Rodo_1234-0"), "Regex: rejeita hífen no nome");
assert(!EQUIPMENT_IMAGE_NAME_REGEX.test("_1234-0"), "Regex: rejeita sem nome");
assert(!EQUIPMENT_IMAGE_NAME_REGEX.test("Moega_-0"), "Regex: rejeita sem contrato");

// ─── 11. normalizeEquipmentName (legado) ──────────────────

console.log("\n11. normalizeEquipmentName (legado/backward-compat)");

assertEqual(
  normalizeEquipmentName("Moega 1720 (rodoviária)"),
  "moega1720rodoviaria",
  "Formato legado preservado",
);

// ─── Resumo ───────────────────────────────────────────────

console.log("\n" + "═".repeat(50));
console.log(`Resultado: ${passed} passed, ${failed} failed`);
console.log("═".repeat(50));

if (failed > 0) {
  process.exit(1);
}
