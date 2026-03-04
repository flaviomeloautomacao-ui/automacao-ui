# Automação de Laudos Técnicos

Plataforma de automação de laudos DHA com Next.js (App Router), Supabase (PostgreSQL) e Prisma.

## Pré-requisitos

- Node.js 20+
- Acesso a um banco PostgreSQL (Supabase)

## Setup Inicial

```bash
# 1. Instale dependências
npm install

# 2. Configure variáveis de ambiente
# Copie .env.example para .env e preencha DATABASE_URL
cp .env.example .env

# 3. Gere o Prisma Client
npm run prisma:generate

# 4. Rode a migration inicial
npx prisma migrate dev --name init

# 5. Inicie o servidor de desenvolvimento
npm run dev
```

## Banco de Dados (Prisma + Supabase)

O projeto usa **Prisma** como ORM sobre um PostgreSQL hospedado no **Supabase**.

### Variáveis de Ambiente

| Variável | Descrição | Prefixo público? |
|---|---|---|
| `DATABASE_URL` | Connection string PostgreSQL | **NÃO** |

> A `DATABASE_URL` nunca deve ser exposta ao client. Não use `NEXT_PUBLIC_`.

### Comandos Prisma

```bash
# Gerar Prisma Client após alterar o schema
npm run prisma:generate

# Criar/aplicar migrations
npm run prisma:migrate
# ou com nome específico:
npx prisma migrate dev --name <nome>

# Abrir Prisma Studio (visualizador do banco)
npm run prisma:studio

# Push direto sem migration (dev only)
npm run prisma:push
```

### Regras de Acesso ao Banco

Prisma **só pode ser usado em contexto server-side**:
- Server Components
- Route Handlers (`/app/api`)
- Server Actions

**Nunca** importe `lib/prisma.ts` em Client Components.

## Desenvolvimento

```bash
npm run dev      # Inicia dev server
npm run build    # Build de produção
npm run lint     # ESLint
```

## Estrutura de Pastas

```
app/              → Rotas Next.js (App Router)
  (public)/       → Rotas públicas
  api/            → Route Handlers
components/       → Componentes React
lib/              → Utilitários e configuração
  prisma.ts       → Singleton do PrismaClient
  generated/      → Prisma Client gerado (gitignored)
prisma/           → Schema e migrations
docs/             → Documentação e exemplos
```
