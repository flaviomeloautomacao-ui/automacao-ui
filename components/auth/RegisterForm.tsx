"use client";

import { useState, type FormEvent } from "react";
import css from "./RegisterForm.module.css";

export function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || undefined, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message || "Erro ao criar usuário.");
      } else {
        setSuccess(`Usuário ${data.data.email} criado com sucesso!`);
        resetForm();
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={css.form} onSubmit={handleSubmit}>
      {error && <div className={css.error}>{error}</div>}
      {success && <div className={css.success}>{success}</div>}

      <div className={css.field}>
        <label htmlFor="name" className={css.label}>
          Nome <span className={css.optional}>(opcional)</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={css.input}
          placeholder="Nome do usuário"
          autoComplete="name"
        />
      </div>

      <div className={css.field}>
        <label htmlFor="reg-email" className={css.label}>
          Email
        </label>
        <input
          id="reg-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={css.input}
          placeholder="usuario@empresa.com"
          required
          autoComplete="email"
        />
      </div>

      <div className={css.field}>
        <label htmlFor="reg-password" className={css.label}>
          Senha
        </label>
        <input
          id="reg-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={css.input}
          placeholder="Mínimo 6 caracteres"
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>

      <div className={css.field}>
        <label htmlFor="reg-confirm" className={css.label}>
          Confirmar Senha
        </label>
        <input
          id="reg-confirm"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={css.input}
          placeholder="Repita a senha"
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>

      <button type="submit" className={css.button} disabled={loading}>
        {loading ? "Criando…" : "Criar Usuário"}
      </button>
    </form>
  );
}
