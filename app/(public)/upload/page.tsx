"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { ToastProvider, useToast } from "@/components/ui/Toast";

/* ------------------------------------------------------------------ */
/*  Inner content — needs ToastProvider above it                       */
/* ------------------------------------------------------------------ */

function UploadContent() {
  const { toast } = useToast();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1.5rem" }}>
        UI Components — Demo
      </h1>

      {/* ---- Buttons ---- */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.75rem" }}>
          Button
        </h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" size="lg">Large</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
      </section>

      {/* ---- Badges ---- */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.75rem" }}>
          Badge
        </h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Badge variant="info">Info</Badge>
          <Badge variant="success">Sucesso</Badge>
          <Badge variant="warning">Aviso</Badge>
          <Badge variant="error">Erro</Badge>
          <Badge variant="neutral">Neutro</Badge>
        </div>
      </section>

      {/* ---- Progress ---- */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.75rem" }}>
          Progress
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Progress value={25} label="Etapa 1" showValue color="blue" />
          <Progress value={60} label="Etapa 2" showValue color="green" />
          <Progress value={90} label="Etapa 3" showValue color="yellow" />
          <Progress value={100} label="Concluído" showValue color="green" />
        </div>
      </section>

      {/* ---- Card ---- */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.75rem" }}>
          Card
        </h2>
        <Card>
          <CardHeader>Upload de Arquivo</CardHeader>
          <CardBody>
            <p style={{ marginBottom: "0.5rem" }}>
              Selecione um arquivo <Badge variant="info">.csv</Badge> ou{" "}
              <Badge variant="info">.xlsx</Badge> para importar.
            </p>
            <Progress value={45} label="Enviando..." showValue color="blue" />
          </CardBody>
          <CardFooter>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <Button variant="secondary" size="sm">Cancelar</Button>
              <Button variant="primary" size="sm">Enviar</Button>
            </div>
          </CardFooter>
        </Card>
      </section>

      {/* ---- Toast ---- */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.75rem" }}>
          Toast
        </h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button variant="primary" size="sm" onClick={() => toast("Informação geral", "info")}>
            Info
          </Button>
          <Button variant="primary" size="sm" onClick={() => toast("Operação realizada!", "success")}>
            Sucesso
          </Button>
          <Button variant="primary" size="sm" onClick={() => toast("Atenção necessária", "warning")}>
            Aviso
          </Button>
          <Button variant="danger" size="sm" onClick={() => toast("Algo deu errado", "error")}>
            Erro
          </Button>
        </div>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Page (wraps content with ToastProvider)                            */
/* ------------------------------------------------------------------ */

export default function UploadPage() {
  return (
    <ToastProvider duration={3000}>
      <UploadContent />
    </ToastProvider>
  );
}
