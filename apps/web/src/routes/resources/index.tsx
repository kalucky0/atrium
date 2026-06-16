import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { trpc } from "../../lib/trpc";
import { requireAuth } from "../../lib/auth-client";

export const Route = createFileRoute("/resources/")({
  beforeLoad: requireAuth,
  component: ResourcesPage,
});

function ResourcesPage() {
  const utils = trpc.useUtils();
  const list = trpc.resource.list.useQuery();
  const create = trpc.resource.create.useMutation({
    onSuccess: () => utils.resource.list.invalidate(),
  });

  const [name, setName] = useState("");
  const [kind, setKind] = useState("room");

  return (
    <div>
      <h1>Zasoby</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ name, kind });
          setName("");
        }}
      >
        <input
          placeholder="Nazwa"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="room">sala</option>
          <option value="equipment">sprzęt</option>
        </select>
        <button disabled={create.isPending}>Dodaj</button>
      </form>

      {list.isPending ? (
        <p className="muted">Ładowanie…</p>
      ) : list.data && list.data.length > 0 ? (
        <ul>
          {list.data.map((r) => (
            <li key={r.id}>
              <Link to="/resources/$resourceId" params={{ resourceId: r.id }}>
                {r.name}
              </Link>{" "}
              <span className="muted">({r.kind})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Brak zasobów — dodaj pierwszy powyżej.</p>
      )}
    </div>
  );
}
