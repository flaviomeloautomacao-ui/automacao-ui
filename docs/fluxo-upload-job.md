# Fluxo Completo: Criar Job com Planilha

## FASE 1 — Cliente (Browser)

**Arquivo**: `components/upload/UploadForm.tsx`

1. **Usuário seleciona arquivo** no `<input type="file">` + escolhe perfil (dust/gas/vapors)
2. **Clica "Criar Job"** → dispara `handleSubmit()`
3. **Validação client-side** (instantânea, sem rede):
   - Verifica se profile foi selecionado
   - Verifica se arquivo foi escolhido e não está vazio
   - Verifica extensão (`.xlsx` ou `.csv`)
   - Verifica tamanho (< 20MB)
   - Se falhou → mostra erro, **para aqui**
4. **Monta `FormData`** com o arquivo cru + profile
5. **`fetch POST /api/jobs`** — envia o arquivo inteiro pelo body multipart
6. **Aguarda resposta JSON**: se erro → mostra mensagem + detalhes de validação; se sucesso → `router.push(/jobs/{id})`

**Custo**: mínimo. Nenhum processamento pesado no browser. O arquivo é enviado como está.

---

## FASE 2 — Server Route Handler (`app/api/jobs/route.ts`)

### Passo 1 — Parse do FormData

```typescript
formData = await request.formData()
```

- Next.js lê o body multipart e extrai o `File` e o `profile`.
- **Custo**: proporcional ao tamanho do arquivo (~40KB no caso da planilha). Baixo.

### Passo 2 — Validação de campos obrigatórios

- Verifica se `file` existe, se `profile` não está vazio.
- **Custo**: negligível.

### Passo 3 — Validação de extensão

- Compara `.xlsx`/`.csv` contra `ALLOWED_EXTENSIONS`.
- **Custo**: negligível.

### Passo 4 — Validação de tamanho

- `file.size > 20MB` → rejeita.
- **Custo**: negligível.

### Passo 5 — Leitura do arquivo em memória + Parsing

```typescript
const arrayBuffer = await file.arrayBuffer();  // ← cópia 1 do arquivo
const buffer = Buffer.from(arrayBuffer);        // ← cópia 2 do arquivo
rawRows = parseSpreadsheet(buffer, ...);
```

**Dentro de `parseSpreadsheet`** (`lib/spreadsheetParser.ts`):

- **Para `.xlsx`**: `XLSX.read(buffer)` decodifica o zip XML do Excel internamente, depois `sheet_to_json` converte para `string[][]`. A lib SheetJS faz tudo em memória.
- **Para `.csv`**: `buffer.toString("utf-8")` + `csvParse(content)` com `;` como delimitador.

**Resultado**: `string[][]` — ex: 77 linhas × 12 colunas.

**Custo**: **PONTO DE ATENÇÃO 1**. Para a planilha atual (~40KB, 77 linhas) é instantâneo. Mas:

- O buffer é copiado 2x em memória (`arrayBuffer` → `Buffer`)
- SheetJS processa o XML inteiro do XLSX em memória
- Para planilhas grandes (ex: 5000 linhas com campos multiline) pode usar ~10-50MB de RAM

### Passo 6 — Validação contra o contrato

**Dentro de `validateSpreadsheet`** (`lib/spreadsheetContract.ts`):

1. **Busca o cabeçalho** — varre até 20 linhas procurando uma que contenha TODAS as 8 colunas obrigatórias (comparação case-insensitive). Complexidade: O(20 × 8 × 12) = ~1920 comparações. Negligível.

2. **Extrai metadados** — varre as linhas antes do cabeçalho procurando "Projeto:", "Data:", "Revisão:". Complexidade: O(5 × 12) = 60 operações.

3. **Monta mapa de colunas** — `buildColumnIndexMap` faz `findIndex` para cada coluna no header. O(11 × 12).

4. **Valida cada linha** — itera por 69 linhas × 11 colunas:
   - Verifica campo obrigatório vazio
   - Verifica enum values (lowercase comparison)
   - Verifica numéricos (nenhum no schema atual)

   Complexidade: O(69 × 11) = ~759 verificações.

5. **Monta `normalizedRows`** — array de 69 objetos `Record<string, string>`, cada um com 11 chaves.

**Custo**: **muito baixo**. Tudo em CPU, sem I/O, para 69 linhas é microsegundos.

**Resultado em memória neste ponto**:

- `buffer` — ~40KB (arquivo original, mantido para upload ao Storage)
- `rawRows` — ~77 arrays de strings
- `validation.rows` — 69 objetos normalizados

---

### Passo 7 — Persistência Prisma (dentro de `$transaction`)

**Tudo em uma única transação SQL**:

**7a.** `INSERT INTO jobs` — 1 insert com ~8 campos.

**7b.** `INSERT INTO spreadsheet_uploads` — 1 insert com ~8 campos + JSON metadata.

**7c.** `INSERT INTO spreadsheet_rows` — **em batches de 500**:

```typescript
for (let i = 0; i < validation.rows.length; i += BATCH_SIZE) {
  const batch = validation.rows.slice(i, i + BATCH_SIZE);
  await tx.spreadsheetRow.createMany({ data: batch.map(...) });
}
```

Para 69 linhas → **1 único batch** com 1 `INSERT ... VALUES (69 registros)`.

Cada registro contém:

- `uploadId` (uuid)
- `rowIndex` (int)
- `equipmentName` (string)
- `equipmentDescription` (string — pode ser longo, ~500 chars)
- `rawJson` (JSON — objeto com 11 campos)
- `normalizedJson` (JSON — **mesmo objeto**, duplicado)

**Custo**: **PONTO DE ATENÇÃO 2**.

- A transação faz 3 queries: 1 INSERT simples + 1 INSERT simples + 1 INSERT com 69 rows.
- Cada row do `spreadsheet_rows` armazena o JSON completo **duas vezes** (`rawJson` e `normalizedJson` são idênticos atualmente).
- Para a planilha atual: ~69 × 2 × ~1KB = ~138KB de JSON no banco. Aceitável.
- Para 5000 linhas com textos longos: pode chegar a ~10-50MB em uma única transação. **Pode ser lento**.
- A conexão é via Supabase pooler (rede remota), então a latência de cada query é ~50-200ms.

**Total de queries na transação**: 3 (ou mais se linhas > 500, pois faz batches adicionais).

---

### Passo 8 — Upload ao Supabase Storage (fora da transação)

```typescript
await ensureStorageBucket();  // ← verifica/cria bucket (1-2 requests HTTP)

await getSupabaseAdmin().storage
  .from(STORAGE_BUCKET)
  .upload(storagePath, buffer, { ... });  // ← upload do arquivo original

await prisma.job.update({  // ← salva archivePath + archiveExpiresAt
  where: { id: job.id },
  data: { archivePath, archiveExpiresAt },
});
```

**8a. `ensureStorageBucket()`** — na primeira chamada faz `getBucket()` (1 HTTP request). Se não existe, faz `createBucket()` (mais 1 HTTP). Depois guarda flag `bucketEnsured = true` e nunca mais chama.

**8b. Upload do buffer** — envia o buffer (~40KB) via HTTP para Supabase Storage.

**8c. Update do Job** — 1 query SQL para salvar o path e expiração.

**Custo**: **PONTO DE ATENÇÃO 3**.

- São **2 requests HTTP para o Supabase** (storage upload + 1 query extra de update).
- O `ensureStorageBucket` na primeira vez adiciona +1-2 requests.
- Isso tudo está **fora da transação**, ou seja, se o storage falhar, o Job já existe no banco (com as 69 rows), mas é marcado como `error`.
- O buffer (`~40KB`) permanece em memória até aqui para ser enviado.

---

### Passo 9 — Resposta ao cliente

Retorna `{ jobId, status: "queued" }` com HTTP 201.

---

## Resumo de custos por etapa

| Etapa | CPU | Memória | I/O (rede) | Latência estimada |
|-------|-----|---------|-----------|-------------------|
| Client validation | Min | Min | 0 | <1ms |
| FormData parse | Baixo | ~40KB | 0 | <5ms |
| `file.arrayBuffer()` + `Buffer.from()` | Baixo | **2× o arquivo** | 0 | <1ms |
| `XLSX.read()` (SheetJS) | Médio | ~3-5× o arquivo | 0 | ~10-50ms |
| `validateSpreadsheet()` | Baixo | ~200KB (rows normalizadas) | 0 | <5ms |
| Transação Prisma (3 queries) | Baixo | ~140KB (JSON) | **3 roundtrips Supabase** | ~300-600ms |
| `ensureStorageBucket()` | Min | Min | 1-2 HTTP requests | ~100-200ms (só 1ª vez) |
| Storage upload | Min | 0 (já tem buffer) | 1 HTTP upload | ~100-300ms |
| `job.update` (archivePath) | Min | Min | 1 roundtrip | ~100-200ms |
| **TOTAL** | | | **5-7 roundtrips** | **~700ms-1.5s** |

---

## Pontos de melhoria identificados

### 1. `rawJson` e `normalizedJson` são idênticos

Em `route.ts` (linhas 183-184), ambos recebem o mesmo `row`. Isso **dobra o tamanho do JSON no banco** sem benefício. Atualmente não há nenhuma transformação que diferencie os dois. Opções:

- Remover `normalizedJson` até que exista de fato uma versão "normalizada" diferente
- Ou salvar `rawJson` como o texto original da célula e `normalizedJson` como versão tratada (trim, lowercase nos enums, etc.)

### 2. Buffer copiado 2× desnecessariamente

```typescript
const arrayBuffer = await file.arrayBuffer(); // cópia 1
const buffer = Buffer.from(arrayBuffer);       // cópia 2
```

Para 40KB é irrelevante. Para 20MB, são 3 cópias em memória (File + ArrayBuffer + Buffer). Pode usar `Buffer.from(await file.arrayBuffer())` numa só linha, mas o JS engine ainda aloca 2 vezes. Não há como evitar totalmente com a API Web `File`.

### 3. Upload ao Storage está no caminho crítico da response

O cliente espera a response até o Storage upload terminar (~100-300ms extras). Alternativa: retornar o `jobId` imediatamente após a transação Prisma e fazer o upload ao Storage de forma assíncrona (fire-and-forget ou via uma queue). Isso reduziria o tempo de resposta percebido pelo usuário em ~200-400ms.

### 4. Update separado do archivePath

Após a transação principal, há um `prisma.job.update()` extra só para salvar `archivePath`. Isso poderia ser evitado se o path fosse calculado antes da transação e incluído no `job.create()` inicial (já que o path é determinístico: `{uuid}/{date}/{filename}`). Economizaria 1 roundtrip.

### 5. `ensureStorageBucket()` na primeira request

O primeiro upload de cada instance do server faz +1-2 HTTP requests extras para verificar/criar o bucket. Depois é cacheado via flag booleana. Aceitável, mas em ambiente serverless (Vercel), cada cold start repete isso.

### 6. Escalabilidade para planilhas grandes (5000 linhas)

O batch de 500 rows com JSON completo por row pode gerar queries de INSERT muito grandes. Para planilhas com descrições longas (~1KB por row × 500 × 2 JSONs), um batch pode chegar a ~1MB de payload SQL. Sugestão: reduzir `BATCH_SIZE` para 100-200 ou usar streaming.

### 7. Sem compressão no upload ao Storage

O arquivo é enviado tal qual. Para `.xlsx` isso é ok (já é zip internamente). Para `.csv` grandes, um gzip antes do upload economizaria bandwidth.
