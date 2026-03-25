"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import css from "./LoginForm.module.css";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Email ou senha inválidos.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Erro ao fazer login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={css.form} onSubmit={handleSubmit}>
      {error && <div className={css.error}>{error}</div>}

      <div className={css.field}>
        <label htmlFor="email" className={css.label}>
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={css.input}
          placeholder="voce@empresa.com"
          required
          autoComplete="email"
          autoFocus
        />
      </div>

      <div className={css.field}>
        <label htmlFor="password" className={css.label}>
          Senha
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={css.input}
          placeholder="••••••••"
          required
          autoComplete="current-password"
        />
      </div>

      <button type="submit" className={css.button} disabled={loading}>
        {loading && <span className={css.spinner} />}
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
