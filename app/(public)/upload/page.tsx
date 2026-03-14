import { UploadForm } from "@/components/upload/UploadForm";

export const metadata = {
  title: "Novo Laudo — DHA Automação",
};

export default function UploadPage() {
  return (
    <div>
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
          Novo Laudo Técnico
        </h1>
        <p style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)" }}>
          Selecione o perfil de risco e faça upload da planilha para iniciar.
        </p>
      </div>
      <UploadForm />
    </div>
  );
}
