import { createFileRoute, Link } from "@tanstack/react-router";
import { trpc } from "../lib/trpc";
import { requireAuth } from "../lib/auth-client";

export const Route = createFileRoute("/my-reservations")({
  beforeLoad: requireAuth,
  component: MyReservationsPage,
});

function MyReservationsPage() {
  const utils = trpc.useUtils();
  const list = trpc.reservation.listByUser.useQuery();
  const cancel = trpc.reservation.cancel.useMutation({
    onSuccess: () => utils.reservation.listByUser.invalidate(),
  });

  return (
    <div>
      <h1>Moje rezerwacje</h1>

      {list.isPending ? (
        <p className="muted">Ładowanie…</p>
      ) : list.data && list.data.length > 0 ? (
        <ul>
          {list.data.map((res) => (
            <li key={res.id}>
              <Link to="/resources/$resourceId" params={{ resourceId: res.resourceId }}>
                {res.resourceName}
              </Link>{" "}
              <span className="muted">{res.during}</span>{" "}
              <button
                className="error"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate({ id: res.id })}
              >
                Odwołaj
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Brak rezerwacji.</p>
      )}
    </div>
  );
}
