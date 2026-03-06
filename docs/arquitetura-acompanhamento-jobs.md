# Arquitetura — Sistema de Acompanhamento de Jobs

> Documento técnico de arquitetura para o sistema de processamento assíncrono
> de laudos técnicos com acompanhamento em tempo real.

---

## 1. Visão Geral

```
┌──────────────┐     POST /api/jobs      ┌──────────────────┐
│   Navegador  │ ──────────────────────►  │   Next.js API    │
│  (React SPA) │                          │  (Route Handler) │
│              │ ◄────── 201 { jobId } ── │                  │
│              │                          │  1. Valida XLSX  │
│              │                          │  2. Cria Job      │
│              │                          │  3. Cria Steps    │
│              │                          │  4. Upload Storage│
│              │                          │  5. Fire & Forget │
│              │                          └────────┬─────────┘
│              │                                   │ POST /process
│              │                                   │ (fire-and-forget)
│              │                                   ▼
│              │                          ┌──────────────────┐
│  GET /api/   │                          │  Python Service   │
│  jobs/:id    │                          │  (FastAPI)        │
│  (polling    │                          │                   │
│   3s)        │                          │  BackgroundTask:  │
│              │                          │  1. Parse dados   │
│              │  ┌────────────────────┐  │  2. Análise LLM   │
│              │  │   PostgreSQL       │  │  3. Gera PDF      │
│              │  │   (Supabase)       │  │  4. Salva Storage │
│              │──│                    │◄─│  5. Atualiza DB   │
│              │  │  jobs              │  │                   │
│              │  │  job_steps         │  └──────────────────┘
│              │  │  spreadsheet_*     │
└──────────────┘  └────────────────────┘
```

### Princípios

| Princípio | Implementação |
|-----------|---------------|
| **Não-bloqueante** | POST retorna imediato; processamento é background |
| **Banco como fonte de verdade** | Python atualiza DB diretamente; Front lê via polling |
| **Resiliência** | Falhas marcam job como `error`; steps indicam onde falhou |
| **Simplicidade** | Polling HTTP simples (poucos jobs/dia, 1 cliente) |

---

## 2. Modelo de Dados

### 2.1 Job

```prisma
model Job {
  id           String    @id @default(uuid())
  filename     String?
  profile      String                          // "dust", "gas", "vapors"
  status       JobStatus @default(queued)       // enum abaixo
  progress     Int?      @default(0)            // 0-100
  currentStep  String?                          // etapa legível atual
  rowCount     Int?
  errorCode    String?
  errorMessage String?

  archivePath      String?
  archiveExpiresAt DateTime?

  pdfPath    String?
  startedAt  DateTime?                          // início do processamento
  finishedAt DateTime?                          // conclusão ou falha

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  steps JobStep[]
}
```

### 2.2 JobStatus (enum)

| Status | Descrição |
|--------|-----------|
| `queued` | Job criado, aguardando processamento |
| `processing` | Pipeline em execução no Python |
| `done` | Laudo gerado com sucesso |
| `error` | Falha em alguma etapa |

### 2.3 JobStep

```prisma
model JobStep {
  id           String    @id @default(uuid())
  jobId        String
  name         String    // identificador técnico
  label        String    // rótulo exibido no front
  status       JobStatus @default(queued)
  order        Int       // sequência: 1, 2, 3…
  startedAt    DateTime?
  completedAt  DateTime?
  errorMessage String?
}
```

### 2.4 Pipeline Steps (predefinidos)

| Order | Name | Label | Progress Range |
|-------|------|-------|----------------|
| 1 | `upload_storage` | Upload e Armazenamento | 0–10% |
| 2 | `data_processing` | Processamento dos Dados | 10–30% |
| 3 | `llm_analysis` | Análise e Recomendações via IA | 30–70% |
| 4 | `pdf_rendering` | Geração do PDF | 70–85% |
| 5 | `report_storage` | Armazenamento do Relatório | 85–100% |

---

## 3. Fluxo Completo do Sistema

### 3.1 Criação do Job (Next.js)

```
1. Usuário submete planilha + perfil via UploadForm
2. POST /api/jobs recebe FormData
3. Validação client-side (extensão, tamanho)
4. Validação server-side (parse + contrato da planilha)
5. Transação Prisma:
   a. Cria Job (status=queued, progress=0)
   b. Cria SpreadsheetUpload
   c. Insere SpreadsheetRows (batches de 500)
   d. Cria 5 JobSteps (todas queued)
6. Upload do arquivo no Supabase Storage
7. Marca step "upload_storage" como done, progress=10
8. Fire-and-forget: POST /process no Python Service
   (NÃO aguarda resposta — o fetch roda sem await)
9. Retorna 201 { jobId, status: "queued" }
10. Front redireciona para /jobs/{jobId}
```

### 3.2 Processamento (Python Service)

```
1. POST /process recebe job_id + file + profile
2. Retorna imediatamente { status: "accepted" }
3. BackgroundTask inicia pipeline:
   a. Atualiza job: status=processing, started_at=now()
   b. Step data_processing:
      - Parse + validação + criação de draft
      - Progress: 10% → 30%
   c. Step llm_analysis:
      - Geração de seções narrativas via OpenRouter/GPT-4
      - Progress: 30% → 70%
   d. Step pdf_rendering:
      - Renderização HTML (Jinja2) → PDF (WeasyPrint)
      - Progress: 70% → 85%
   e. Step report_storage:
      - Upload do PDF no Supabase Storage
      - Persistência de metadados
      - Progress: 85% → 100%
   f. Marca job: status=done, progress=100, pdfPath=...

4. Em caso de erro em qualquer etapa:
   - Marca step atual como error com mensagem
   - Marca job como error com código + mensagem
   - Front exibe erro ao próximo polling cycle
```

### 3.3 Acompanhamento (Front-end)

```
1. Página /jobs/{jobId} carrega via Server Component (fetch no-store)
2. Componente JobDetail recebe dados iniciais e inicia polling
3. Polling a cada 3s: GET /api/jobs/{id} (inclui steps)
4. Renderiza:
   - Barra de progresso com porcentagem
   - Etapa atual (currentStep) em texto
   - Stepper visual com todas as 5 etapas
   - Status badge (Na fila / Processando / Concluído / Erro)
5. Quando status é terminal (done/error):
   - Para polling automaticamente
   - Exibe banner de sucesso + botão Download
   - Ou banner de erro com código e mensagem
```

---

## 4. Endpoints da API

### 4.1 Next.js (porta 3000)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/jobs` | Lista jobs (limit/offset) |
| `POST` | `/api/jobs` | Cria job + dispara processamento |
| `GET` | `/api/jobs/:id` | Detalhe do job + steps |
| `PATCH` | `/api/jobs/:id` | Atualiza job (status, progress, etc.) |
| `PATCH` | `/api/jobs/:id/steps/:stepName` | Atualiza step específica |
| `GET` | `/api/jobs/:id/download` | Gera signed URL para o PDF |

### 4.2 Python Service (porta 8001)

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/process` | **NOVO** — Aceita job_id + file, processa em background |
| `POST` | `/uploads` | Legado — processamento síncrono (mantido para retrocompatibilidade) |
| `GET` | `/health` | Health check |

---

## 5. Estratégia de Atualização no Front-end

### Abordagem: **HTTP Polling (3 segundos)**

#### Justificativa

| Critério | Polling | SSE | WebSocket |
|----------|---------|-----|-----------|
| Complexidade | ✅ Mínima | Média | Alta |
| Infra adicional | ✅ Nenhuma | Nenhuma | Servidor WS |
| Adequação (poucos jobs/dia) | ✅ Perfeito | Over-engineering | Over-engineering |
| Compatibilidade | ✅ Universal | Boa | Boa |
| Latência (3s) | Aceitável | Tempo real | Tempo real |

**Para o cenário atual (poucos jobs/dia, 1 cliente), polling a cada 3s é a escolha ideal:**
- Zero infra adicional
- Implementação trivial (setInterval + fetch)
- Latência de 3s é imperceptível para o usuário
- Naturalmente resiliente a desconexões (cada ciclo é independente)

#### Configuração

```typescript
const POLL_INTERVAL_MS = 3_000;    // 3 segundos
const MAX_POLL_CYCLES  = 200;      // ~10 minutos (safety net)
const TERMINAL_STATUSES = new Set(["done", "error"]);
```

#### Ciclo de vida

1. Componente monta → verifica se status é terminal
2. Se não-terminal → inicia `setInterval` de 3s
3. Cada ciclo: `GET /api/jobs/:id` → atualiza state
4. Se status é terminal → `clearInterval`, para polling
5. Se atinge 200 ciclos → para (safety net)
6. Componente desmonta → `clearInterval` (cleanup)

---

## 6. UX — Comportamento do Sistema

### 6.1 Após Upload

```
Usuário clica "Criar Job"
  → Exibe "Criando…" no botão (loading state)
  → POST /api/jobs
  → Recebe { jobId } em ~2-3s (validação + upload storage)
  → router.push(`/jobs/${jobId}`)
  → Página do job carrega com status "queued"
```

### 6.2 Página do Job (/jobs/{jobId})

```
┌─────────────────────────────────────────────────────┐
│  Job: planilha_equipamentos.xlsx    [Processando]   │
│  Atualizando automaticamente a cada 3s...           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Progresso                                     45%  │
│  ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  Gerando recomendações via IA…                      │
│                                                     │
│  Etapas do Pipeline                                 │
│  ✓ Upload e Armazenamento           10:30:15       │
│  ✓ Processamento dos Dados          10:30:18       │
│  ⟳ Análise e Recomendações via IA   Iniciado 10:30 │
│  – Geração do PDF                   Aguardando     │
│  – Armazenamento do Relatório       Aguardando     │
│                                                     │
│  ID       a1b2c3d4-...                              │
│  Perfil   dust                                      │
│  Linhas   42                                        │
│  Criado   06/03/2026 10:30:12                       │
│                                                     │
├─────────────────────────────────────────────────────┤
│  [Voltar à lista]                                   │
└─────────────────────────────────────────────────────┘
```

### 6.3 Quando Concluído

```
┌─────────────────────────────────────────────────────┐
│  Job: planilha_equipamentos.xlsx    [Concluído]     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Progresso                                    100%  │
│  ██████████████████████████████████████████████████  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  ✅ Laudo concluído com sucesso!               │  │
│  │  O PDF está pronto para download.             │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Etapas do Pipeline                                 │
│  ✓ Upload e Armazenamento           10:30:15       │
│  ✓ Processamento dos Dados          10:30:18       │
│  ✓ Análise e Recomendações via IA   10:31:45       │
│  ✓ Geração do PDF                   10:32:02       │
│  ✓ Armazenamento do Relatório       10:32:05       │
│                                                     │
├─────────────────────────────────────────────────────┤
│  [Voltar à lista]    [Baixar PDF]                   │
└─────────────────────────────────────────────────────┘
```

### 6.4 Quando Erro

```
┌─────────────────────────────────────────────────────┐
│  Job: planilha_equipamentos.xlsx    [Erro]          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  ❌ Ocorreu um erro no processamento           │  │
│  │  Código: LLM_ERROR                            │  │
│  │  Falha no serviço de geração de texto.        │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ✓ Upload e Armazenamento           10:30:15       │
│  ✓ Processamento dos Dados          10:30:18       │
│  ✕ Análise e Recomendações via IA   ERRO           │
│  – Geração do PDF                   Aguardando     │
│  – Armazenamento do Relatório       Aguardando     │
│                                                     │
├─────────────────────────────────────────────────────┤
│  [Voltar à lista]                                   │
└─────────────────────────────────────────────────────┘
```

---

## 7. Estratégia de Resiliência

### 7.1 Python Service cai durante processamento

| Cenário | Comportamento |
|---------|---------------|
| Python cai no meio de um job | Job fica com status `processing` no banco |
| Python reinicia | Jobs antigos **não** são retomados automaticamente |
| Front-end | Polling continua por até ~10 min; se não mudar, usuário vê "Processando" |

**Mitigação — Stale Job Detector:**

Implementar um cron job ou endpoint que detecta jobs travados:

```sql
-- Jobs processando há mais de 15 minutos
SELECT id FROM jobs
WHERE status = 'processing'
AND started_at < NOW() - INTERVAL '15 minutes';
```

Ação: marcar como `error` com código `STALE_JOB`:

```sql
UPDATE jobs
SET status = 'error',
    error_code = 'STALE_JOB',
    error_message = 'Job travou durante processamento. Tente novamente.',
    finished_at = NOW()
WHERE id IN (...);
```

### 7.2 Fire-and-forget falha (Python indisponível)

O `.catch()` no fire-and-forget do Next.js marca o job como `error`:

```typescript
fetch(`${PYTHON_SERVICE_URL}/process`, { ... })
  .catch((err) => {
    prisma.job.update({
      where: { id: job.id },
      data: {
        status: "error",
        errorCode: "PYTHON_SERVICE_UNREACHABLE",
        errorMessage: "Serviço de geração não está disponível.",
      },
    });
  });
```

### 7.3 Evitar jobs duplicados

O sistema já é naturalmente protegido:
- Cada upload cria 1 job com UUID único
- O botão "Criar Job" fica disabled durante loading
- Não há fila compartilhada — cada job é processado individualmente
- Se o mesmo arquivo for enviado novamente, um novo job é criado (comportamento esperado)

### 7.4 Retentativa manual

Para jobs com erro, o fluxo de retry é:
1. Usuário volta à página de upload
2. Sobe o arquivo novamente
3. Novo job é criado com novo UUID
4. Processamento recomeça do zero

> **Nota:** Retentativa automática não é implementada nesta versão.
> Para evolução futura, pode-se adicionar um botão "Reprocessar" na
> página do job que cria um novo job a partir dos dados já salvos.

### 7.5 Idempotência do processamento

O Python cria novos registros (upload, draft, report) a cada execução.
Não há risco de duplicação de estado — cada run é independente.
O pior caso é um PDF órfão no Storage se o job falhar após o upload do PDF
mas antes de marcar `done`.

---

## 8. Estrutura de Arquivos Modificados/Criados

### Next.js (AutomacaoDHA)

```
prisma/schema.prisma                        ← +startedAt, +currentStep no Job
lib/constants.ts                            ← +PIPELINE_STEPS, +POLL_*, +TERMINAL_STATUSES
lib/types.ts                                ← +currentStep, +startedAt no UpdateJobPayload
lib/validators.ts                           ← +currentStep/startedAt no updateJobSchema, +updateStepSchema
app/api/jobs/route.ts                       ← POST refatorado (fire-and-forget)
app/api/jobs/[id]/route.ts                  ← PATCH suporta currentStep/startedAt
app/api/jobs/[id]/steps/[stepName]/route.ts ← NOVO — PATCH step por nome
components/jobs/JobDetail.tsx               ← Exibe currentStep; usa constantes
```

### Python (PythonServiceAutomacao)

```
app/adapters/db/job_models.py               ← NOVO — SQLAlchemy Job + JobStep
app/adapters/db/job_repository.py           ← NOVO — CRUD de progresso
app/application/use_cases/process_job.py    ← NOVO — Pipeline com progresso
app/api/routes/process.py                   ← NOVO — POST /process (background)
app/api/main.py                             ← +router process
app/infrastructure/dependencies.py          ← +get_job_repository, +get_process_job_use_case
```

---

## 9. Diagrama de Sequência

```
Usuário          Next.js API         Supabase DB        Python Service
  │                  │                    │                    │
  │─POST /api/jobs──►│                    │                    │
  │                  │──create Job────────►│                    │
  │                  │──create Steps──────►│                    │
  │                  │──upload Storage─────►│                    │
  │                  │──mark step1 done───►│                    │
  │                  │                    │                    │
  │                  │──POST /process─────────────────────────►│
  │◄─201 { jobId }──│  (fire & forget)   │                    │
  │                  │                    │                    │
  │─GET /jobs/{id}──►│                    │                    │
  │◄─{ queued, 10% }│                    │                    │
  │                  │                    │◄──update job───────│
  │                  │                    │   status=processing│
  │                  │                    │                    │
  │─GET /jobs/{id}──►│                    │                    │
  │◄─{ proc, 35% }──│                    │                    │
  │                  │                    │◄──update step 3────│
  │                  │                    │   status=processing│
  │                  │                    │                    │
  │  ... (polling a cada 3s) ...         │                    │
  │                  │                    │                    │
  │                  │                    │◄──update job───────│
  │                  │                    │   status=done      │
  │                  │                    │   progress=100     │
  │                  │                    │   pdfPath=...      │
  │                  │                    │                    │
  │─GET /jobs/{id}──►│                    │                    │
  │◄─{ done, 100% }─│                    │                    │
  │                  │                    │                    │
  │ [Clica Download] │                    │                    │
  │─GET /download───►│──signed URL───────►│                    │
  │◄─{ url: ... }───│                    │                    │
  │─GET pdf ────────────────────────────►│                    │
```

---

## 10. Evolução Futura

| Melhoria | Quando implementar |
|----------|-------------------|
| **Stale job detector** (cron) | Quando o sistema entrar em produção |
| **Botão "Reprocessar"** | Quando houver demanda de retry |
| **SSE em vez de polling** | Se o volume de jobs crescer significativamente |
| **Fila de mensagens** (Redis/SQS) | Se houver múltiplos workers Python |
| **Webhook de conclusão** | Se houver integrações externas |
| **Rate limiting no POST** | Se abrir para múltiplos usuários |
| **Progresso granular por equipamento** | Se o LLM processar equipamentos individualmente |
