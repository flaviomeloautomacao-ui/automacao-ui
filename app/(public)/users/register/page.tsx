import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata = {
  title: "Novo Usuário — Konis Automação",
};

export default function RegisterPage() {
  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <h1
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: "#111827",
          marginBottom: 4,
        }}
      >
        Novo Usuário
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "#6b7280",
          marginBottom: 24,
        }}
      >
        Crie uma nova conta de acesso ao sistema
      </p>
      <RegisterForm />
    </div>
  );
}
