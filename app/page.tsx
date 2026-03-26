import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import css from "./dashboard.module.css";

export default function Home() {
  return (
    <AppShell>
      <div className={css.dashboard}>
        {/* Header */}
        <div className={css.header}>
          <h1 className={css.greeting}>Inicio</h1>
          <p className={css.headerSub}>
            Gerencie seus laudos técnicos de análise de perigos.
          </p>
        </div>

        {/* Quick Actions */}
        <div className={css.actions}>
          <Link href="/upload" className={css.actionCard}>
            <div className={`${css.actionIcon} ${css.iconUpload}`}>
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <div className={css.actionTitle}>Novo Laudo</div>
              <p className={css.actionDesc}>
                Faça upload de uma planilha para iniciar a geração de um novo laudo técnico.
              </p>
            </div>
            <span className={css.actionArrow}>
              Começar
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </span>
          </Link>

          <Link href="/jobs" className={css.actionCard}>
            <div className={`${css.actionIcon} ${css.iconJobs}`}>
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <div className={css.actionTitle}>Histórico de Laudos</div>
              <p className={css.actionDesc}>
                Veja todos os laudos, acompanhe o processamento e baixe PDFs concluídos.
              </p>
            </div>
            <span className={css.actionArrow}>
              Ver todos
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </span>
          </Link>
          <Link href="/llm-costs" className={css.actionCard}>
            <div className={`${css.actionIcon} ${css.iconJobs}`}>
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <div className={css.actionTitle}>Custos LLM</div>
              <p className={css.actionDesc}>
                Monitore o uso e custo de IA em cada processo, com visão técnica detalhada.
              </p>
            </div>
            <span className={css.actionArrow}>
              Monitorar
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </span>
          </Link>
        </div>

        {/* Flow Diagram */}
        <div className={css.flowSection}>
          <h2 className={css.flowTitle}>Como funciona</h2>
          <div className={css.flow}>
            <div className={css.flowStep}>
              <span className={css.flowNumber}>1</span>
              <span className={css.flowLabel}>Upload da Planilha</span>
            </div>
            <span className={css.flowArrow}>
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </span>
            <div className={css.flowStep}>
              <span className={css.flowNumber}>2</span>
              <span className={css.flowLabel}>Complementar Dados</span>
            </div>
            <span className={css.flowArrow}>
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </span>
            <div className={css.flowStep}>
              <span className={css.flowNumber}>3</span>
              <span className={css.flowLabel}>Processamento IA</span>
            </div>
            <span className={css.flowArrow}>
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </span>
            <div className={css.flowStep}>
              <span className={css.flowNumber}>4</span>
              <span className={css.flowLabel}>Download do PDF</span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
