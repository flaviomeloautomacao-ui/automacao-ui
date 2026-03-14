# Redesign do Frontend — AutomacaoDHA

**Data:** 13 de Março de 2026  
**Objetivo:** Modernizar toda a interface, criar design consistente, melhorar UX e responsividade

---

## 1. Diagnóstico — Problemas Atuais

### 1.1 Inconsistência de Estilização
- **3 abordagens misturadas**: CSS Modules, inline styles (60%+ do código), e Tailwind classes
- Cores hardcoded em dezenas de locais (`#2563eb`, `#e5e7eb`, `#6b7280`, etc.)
- Sem design tokens centralizados
- Dark mode implementado parcialmente (CSS Modules sim, inline styles não)

### 1.2 Tipografia Fraca
- `body` usa `Arial, Helvetica, sans-serif` como fallback
- Font Geist carregada mas não aplicada consistentemente
- Sem hierarquia tipográfica clara (tamanhos arbitrários: 0.75rem, 0.8rem, 0.8125rem, 0.85rem, 0.875rem)

### 1.3 Navegação Inexistente
- Sem header/navbar global
- Sem breadcrumbs — usuário perde contexto no fluxo
- Home page é apenas 2 botões centralizados
- Sem indicação clara de onde o usuário está

### 1.4 Responsividade Limitada
- `JobsTable` é uma `<table>` que quebra em mobile  
- `max-width` fixo em inline styles (560px, 800px, 1100px)
- Sem adaptação de layout para tablets
- Imagens no ComplementForm com tamanho fixo (80×80px)

### 1.5 UX do Fluxo Principal
- Upload não tem zona de drag-and-drop visual
- Step indicators do ComplementForm são pills básicos
- Sem feedback visual de loading nos cards
- Banners de status no JobDetail usam inline styles pesados
- `ProfileSelect` com `<select>` nativo — sem visual customizado

---

## 2. Design System — Foundation

### 2.1 Fonte
**Inter** (Google Fonts) — técnica, legível, moderna, excelente para dashboards.

Escala tipográfica:
| Token | Size | Weight | Uso |
|-------|------|--------|-----|
| `--text-xs` | 0.75rem (12px) | 400 | Captions, metadata |
| `--text-sm` | 0.8125rem (13px) | 400 | Body small, labels |
| `--text-base` | 0.875rem (14px) | 400 | Body padrão |
| `--text-lg` | 1rem (16px) | 500 | Subtítulos, Card headers |
| `--text-xl` | 1.25rem (20px) | 600 | Títulos de seção |
| `--text-2xl` | 1.5rem (24px) | 700 | Títulos de página |
| `--text-3xl` | 1.875rem (30px) | 700 | Hero/heading principal |

### 2.2 Paleta de Cores
Base: Slate (mais suave que Zinc, profissional)

| Token | Light | Dark | Uso |
|-------|-------|------|-----|
| `--bg-primary` | `#ffffff` | `#0f172a` | Background principal |
| `--bg-secondary` | `#f8fafc` | `#1e293b` | Background alternativo |
| `--bg-tertiary` | `#f1f5f9` | `#334155` | Background hover/cards |
| `--border` | `#e2e8f0` | `#334155` | Bordas |
| `--border-hover` | `#cbd5e1` | `#475569` | Bordas hover |
| `--text-primary` | `#0f172a` | `#f8fafc` | Texto principal |
| `--text-secondary` | `#475569` | `#94a3b8` | Texto secundário |
| `--text-muted` | `#94a3b8` | `#64748b` | Texto auxiliar |
| `--accent` | `#2563eb` | `#3b82f6` | Cor de destaque (blue-600/500) |
| `--accent-hover` | `#1d4ed8` | `#2563eb` | Hover do accent |
| `--accent-light` | `#eff6ff` | `#1e3a5f` | Background accent suave |
| `--success` | `#16a34a` | `#22c55e` | Sucesso |
| `--success-light` | `#f0fdf4` | `#052e16` | Background sucesso |
| `--warning` | `#d97706` | `#f59e0b` | Aviso |
| `--warning-light` | `#fffbeb` | `#422006` | Background aviso |
| `--error` | `#dc2626` | `#ef4444` | Erro |
| `--error-light` | `#fef2f2` | `#450a0a` | Background erro |

### 2.3 Espaçamento
Escala de 4px:
- `--space-1`: 0.25rem (4px)
- `--space-2`: 0.5rem (8px)
- `--space-3`: 0.75rem (12px)
- `--space-4`: 1rem (16px)
- `--space-5`: 1.25rem (20px)
- `--space-6`: 1.5rem (24px)
- `--space-8`: 2rem (32px)
- `--space-10`: 2.5rem (40px)
- `--space-12`: 3rem (48px)

### 2.4 Border Radius
- `--radius-sm`: 0.375rem (6px) — inputs, small pills
- `--radius-md`: 0.5rem (8px) — cards, buttons
- `--radius-lg`: 0.75rem (12px) — modais, cards grandes
- `--radius-xl`: 1rem (16px) — containers
- `--radius-full`: 9999px — badges, avatars

### 2.5 Sombras
- `--shadow-sm`: `0 1px 2px rgba(0,0,0,0.05)` — sutil
- `--shadow-md`: `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)` — cards
- `--shadow-lg`: `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)` — dropdowns

---

## 3. Plano de Execução — Passo a Passo

### Passo 1: Design System Foundation
- [x] Substituir fonte para Inter no `layout.tsx`
- [x] Criar design tokens via CSS custom properties em `globals.css`
- [x] Importar Inter do next/font/google
- [x] Remover Geist, usar Inter + JetBrains Mono (monospace)

### Passo 2: Layout Global com Navegação
- [x] Criar componente `Sidebar.tsx` com navegação
- [x] Criar layout wrapper com sidebar + content area
- [x] Logo + título "DHA Automação"
- [x] Links: Dashboard (home), Novo Laudo (upload), Histórico (jobs)
- [x] Mobile: hamburger menu ou bottom nav
- [x] Breadcrumbs opcional

### Passo 3: Refatorar UI Primitivos
- [x] `Button.module.css` — usar tokens, melhorar variantes
- [x] `Card.module.css` — usar tokens, melhorar sombras
- [x] `Badge.module.css` — usar tokens
- [x] `Progress.module.css` — usar tokens, animação suave
- [x] `Stepper.module.css` — usar tokens, dark mode
- [x] `Toast.module.css` — usar tokens

### Passo 4: Refatorar Home Page
- [x] Dashboard com cards de ação rápida
- [x] Indicadores visuais do fluxo
- [x] Design responsivo com grid

### Passo 5: Refatorar Upload Page
- [x] Zona de drag-and-drop estilizada
- [x] ProfileSelect com cards visuais em vez de `<select>`
- [x] Indicação de formato aceito com ícones
- [x] Remover inline styles

### Passo 6: Refatorar Jobs Listing
- [x] Cards em vez de tabela para mobile
- [x] Tabela responsiva para desktop
- [x] Filtros visuais por status
- [x] Header com ação "Novo Laudo"
- [x] Remover inline styles

### Passo 7: Refatorar Job Detail
- [x] Layout estruturado sem inline styles
- [x] Banners de status com classes CSS
- [x] Metadata em grid responsivo
- [x] Dark mode completo

### Passo 8: Refatorar Complement Form
- [x] Steps indicator moderno (numbered circles + connectors)
- [x] Form fields usando design tokens
- [x] Image gallery responsiva
- [x] Review page mais visual
- [x] Remover inline styles

### Passo 9: Responsividade Final
- [x] Testar breakpoints: 640px, 768px, 1024px, 1280px
- [x] Jobs table → card view em mobile
- [x] Sidebar → bottom nav em mobile
- [x] Forms → single column em mobile

---

## 4. Arquivos Impactados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `styles/globals.css` | Reescrita completa — design tokens |
| `app/layout.tsx` | Reescrita — fonte Inter, layout com sidebar |
| `app/page.tsx` | Reescrita — dashboard |
| `app/(public)/upload/page.tsx` | Refatoração |
| `app/(public)/jobs/page.tsx` | Refatoração |
| `app/(public)/jobs/[id]/page.tsx` | Ajustes de layout |
| `components/upload/UploadForm.tsx` | Reescrita — drag-and-drop, sem inline styles |
| `components/upload/ProfileSelect.tsx` | Reescrita — cards visuais |
| `components/jobs/JobsTable.tsx` | Reescrita — responsivo |
| `components/jobs/JobsTable.module.css` | Reescrita — design tokens |
| `components/jobs/JobsTableLive.tsx` | Ajustes |
| `components/jobs/JobDetail.tsx` | Reescrita — sem inline styles |
| `components/jobs/JobActions.tsx` | Refatoração |
| `components/ui/Button.module.css` | Refatoração — tokens |
| `components/ui/Card.module.css` | Refatoração — tokens |
| `components/ui/Badge.module.css` | Refatoração — tokens |
| `components/ui/Progress.module.css` | Refatoração — tokens |
| `components/ui/Stepper.module.css` | Refatoração — tokens |
| `components/ui/Toast.module.css` | Refatoração — tokens |
| `components/complement/ComplementForm.module.css` | Refatoração — tokens |
| **NOVO** `components/layout/Sidebar.tsx` | Navegação global |
| **NOVO** `components/layout/Sidebar.module.css` | Estilos da sidebar |
| **NOVO** `components/layout/AppShell.tsx` | Layout wrapper |

---

## 5. Princípios de Design

1. **Consistência**: Zero inline styles. Tudo via CSS Modules + design tokens.
2. **Simplicidade**: Fluxo linear claro — Upload → Complement → Processing → Download.
3. **Responsividade**: Mobile-first, breakpoints em 640/768/1024px.
4. **Acessibilidade**: Focus rings visíveis, labels explícitos, ARIA roles.
5. **Dark mode nativo**: Todas as cores via tokens que mudam por `prefers-color-scheme`.
