import { LoginForm } from "@/components/auth/LoginForm";
import css from "@/components/auth/LoginPage.module.css";

export const metadata = {
  title: "Login — Konis Automação",
};

export default function LoginPage() {
  return (
    <main className={css.page}>
      <div className={css.card}>
        {/* Logo */}
        <div className={css.logoWrap}>
          <div className={css.logo}>Konis Automação</div>
        </div>

        {/* Título */}
        <h1 className={css.title}>Entrar</h1>
        <p className={css.subtitle}>Acesse sua conta para continuar</p>

        {/* Formulário */}
        <LoginForm />

        {/* Rodapé */}
        <p className={css.footer}>© 2026 Konis Automação</p>
      </div>
    </main>
  );
}
