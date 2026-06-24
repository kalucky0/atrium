import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { trpc } from "../../lib/trpc";
import { requireAuth } from "../../lib/auth-client";

type ResourcesSearch = { kind?: "room" | "equipment" };

export const Route = createFileRoute("/resources/")({
  validateSearch: (search: Record<string, unknown>): ResourcesSearch =>
    search.kind === "room" || search.kind === "equipment" ? { kind: search.kind } : {},
  beforeLoad: requireAuth,
  component: ResourcesPage,
});

function ResourcesPage() {
  const { kind: filter } = Route.useSearch();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const list = trpc.resources.list.useQuery(filter ? { kind: filter } : undefined);
  const create = trpc.resources.create.useMutation({
    onSuccess: () => utils.resources.list.invalidate(),
  });

  const [name, setName] = useState("");
  const [kind, setKind] = useState("room");
  const [capacity, setCapacity] = useState("");

  return (
    <div>
      <h1>Zasoby</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ name, kind, capacity: capacity ? Number(capacity) : undefined });
          setName("");
          setCapacity("");
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
        <input
          type="number"
          min="1"
          placeholder="pojemność"
          aria-label="pojemność"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
        />
        <button disabled={create.isPending}>Dodaj</button>
      </form>

      <label>
        Filtr:{" "}
        <select
          value={filter ?? ""}
          onChange={(e) =>
            navigate({
              to: "/resources",
              search: e.target.value ? { kind: e.target.value as "room" | "equipment" } : {},
            })
          }
        >
          <option value="">wszystkie</option>
          <option value="room">sale</option>
          <option value="equipment">sprzęt</option>
        </select>
      </label>

      {list.isPending ? (
        <p className="muted">Ładowanie…</p>
      ) : list.data && list.data.length > 0 ? (
        <ul>
          {list.data.map((r) => (
            <li key={r.id}>
              <Link to="/resources/$resourceId" params={{ resourceId: r.id }}>
                {r.name}
              </Link>{" "}
              <span className="muted">
                ({r.kind}
                {r.capacity != null && `, ${r.capacity} miejsc`})
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Brak zasobów — dodaj pierwszy powyżej.</p>
      )}
    </div>
  );
}
