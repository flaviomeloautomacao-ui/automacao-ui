import { RegisterForm } from "@/components/auth/RegisterForm";
import css from "./register.module.css";

export const metadata = {
  title: "Novo Usuário — Konis Automação",
};

export default function RegisterPage() {
  return (
    <div className={css.container}>
      <div className={css.header}>
        <div className={css.iconWrap}>
          <svg viewBox="0 0 20 20" fill="currentColor" className={css.icon}>
            <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 00-6 6h12a6 6 0 00-6-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
          </svg>
        </div>
        <h1 className={css.title}>Novo Usuário</h1>
        <p className={css.subtitle}>
          Crie uma nova conta de acesso ao sistema
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
