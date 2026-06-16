import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go(mode: "signin" | "signup") {
    setBusy(true);
    setError(null);
    const res =
      mode === "signin"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: email.split("@")[0] });
    setBusy(false);
    if (res.error) setError(res.error.message ?? "Nie udało się");
    else navigate({ to: "/resources" });
  }

  return (
    <div>
      <h1>Logowanie</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go("signin");
        }}
      >
        <input
          type="email"
          placeholder="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="hasło (min. 8 znaków)"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={busy}>
          Zaloguj
        </button>
        <button type="button" disabled={busy} onClick={() => go("signup")}>
          Załóż konto
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
