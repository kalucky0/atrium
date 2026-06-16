import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { trpc } from "../../lib/trpc";
import { requireAuth } from "../../lib/auth-client";

export const Route = createFileRoute("/resources/$resourceId")({
  beforeLoad: requireAuth,
  component: ResourceDetail,
});

function ResourceDetail() {
  const { resourceId } = Route.useParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const q = trpc.resource.byId.useQuery({ id: resourceId });

  const update = trpc.resource.update.useMutation({
    onSuccess: () => {
      utils.resource.byId.invalidate({ id: resourceId });
      utils.resource.list.invalidate();
    },
  });
  const del = trpc.resource.delete.useMutation({
    onSuccess: () => {
      utils.resource.list.invalidate();
      navigate({ to: "/resources" });
    },
  });

  if (q.isPending) return <p className="muted">Ładowanie…</p>;
  if (!q.data) return <p>Nie znaleziono zasobu.</p>;
  const r = q.data;

  return (
    <div>
      <h1>{r.name}</h1>

      <form
        key={r.id}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          update.mutate({
            id: r.id,
            name: String(fd.get("name")),
            kind: String(fd.get("kind")),
            description: (fd.get("description") as string) || null,
          });
        }}
      >
        <input name="name" defaultValue={r.name} required />
        <select name="kind" defaultValue={r.kind}>
          <option value="room">sala</option>
          <option value="equipment">sprzęt</option>
        </select>
        <input name="description" placeholder="opis" defaultValue={r.description ?? ""} />
        <button disabled={update.isPending}>Zapisz</button>
      </form>

      <button className="error" disabled={del.isPending} onClick={() => del.mutate({ id: r.id })}>
        Usuń zasób
      </button>

      <p className="muted">id: {r.id}</p>
    </div>
  );
}
