import { UploadForm } from "@/components/upload/UploadForm";

export const metadata = {
  title: "Upload — Automação DHA",
};

export default function UploadPage() {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1
        style={{
          fontSize: "1.75rem",
          fontWeight: 700,
          marginBottom: "1.5rem",
        }}
      >
        Criar Laudo
      </h1>
      <UploadForm />
    </main>
  );
}
