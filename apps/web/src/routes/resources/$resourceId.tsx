import { useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { trpc } from "../../lib/trpc";
import { requireAuth, useSession } from "../../lib/auth-client";
import {
  HOURS,
  DAY_LABELS,
  addDays,
  weekDays,
  slotStart,
  parseWeek,
  formatWeekParam,
  weekLabel,
  parseDuring,
  overlaps,
  pad2,
} from "../../lib/week";

type Search = { week?: string };

export const Route = createFileRoute("/resources/$resourceId")({
  validateSearch: (search: Record<string, unknown>): Search =>
    typeof search.week === "string" ? { week: search.week } : {},
  beforeLoad: requireAuth,
  component: ResourceDetail,
});

function ResourceDetail() {
  const { resourceId } = Route.useParams();
  const { week } = Route.useSearch();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data: session } = useSession();

  const monday = parseWeek(week, new Date());
  const from = monday;
  const to = addDays(monday, 7);

  const q = trpc.resources.byId.useQuery({ id: resourceId });

  const update = trpc.resources.update.useMutation({
    onSuccess: () => {
      utils.resources.byId.invalidate({ id: resourceId });
      utils.resources.list.invalidate();
    },
  });
  const del = trpc.resources.delete.useMutation({
    onSuccess: () => {
      utils.resources.list.invalidate();
      navigate({ to: "/resources" });
    },
  });

  const availability = trpc.availability.forResource.useQuery({ resourceId, from, to });
  const invalidateWeek = () => utils.availability.forResource.invalidate({ resourceId, from, to });
  const book = trpc.reservations.create.useMutation({ onSuccess: invalidateWeek });
  const cancel = trpc.reservations.cancel.useMutation({ onSuccess: invalidateWeek });

  const parsed = useMemo(
    () =>
      (availability.data ?? []).flatMap((res) => {
        const iv = parseDuring(res.during);
        return iv ? [{ ...res, iv }] : [];
      }),
    [availability.data],
  );

  if (q.isPending) return <p className="muted">Ładowanie…</p>;
  if (!q.data) return <p>Nie znaleziono zasobu.</p>;
  const r = q.data;
  const days = weekDays(monday);
  const busy = book.isPending || cancel.isPending;

  const goWeek = (deltaWeeks: number) =>
    navigate({
      to: "/resources/$resourceId",
      params: { resourceId },
      search: { week: formatWeekParam(addDays(monday, deltaWeeks * 7)) },
    });

  const cellFor = (day: Date, hour: number) => {
    const slot = { start: slotStart(day, hour), end: slotStart(day, hour + 1) };
    return parsed.find((p) => overlaps(p.iv, slot));
  };

  const onCellClick = (day: Date, hour: number, res: (typeof parsed)[number] | undefined) => {
    if (busy) return;
    if (!res) book.mutate({ resourceId, start: slotStart(day, hour), end: slotStart(day, hour + 1) });
    else if (res.userId === session?.user?.id) cancel.mutate({ id: res.id });
  };

  return (
    <div>
      <h1>{r.name}</h1>
      <p className="muted">
        {r.kind}
        {r.capacity != null && ` · pojemność: ${r.capacity}`}
        {r.description && ` · ${r.description}`}
      </p>

      <form
        key={r.id}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const cap = fd.get("capacity") as string;
          update.mutate({
            id: r.id,
            name: String(fd.get("name")),
            kind: String(fd.get("kind")),
            description: (fd.get("description") as string) || null,
            capacity: cap ? Number(cap) : null,
          });
        }}
      >
        <input name="name" defaultValue={r.name} required />
        <select name="kind" defaultValue={r.kind}>
          <option value="room">sala</option>
          <option value="equipment">sprzęt</option>
        </select>
        <input
          type="number"
          min="1"
          name="capacity"
          aria-label="pojemność"
          placeholder="pojemność"
          defaultValue={r.capacity ?? ""}
        />
        <input name="description" placeholder="opis" defaultValue={r.description ?? ""} />
        <button disabled={update.isPending}>Zapisz</button>
      </form>

      <button className="error" disabled={del.isPending} onClick={() => del.mutate({ id: r.id })}>
        Usuń zasób
      </button>

      <h2>Kalendarz</h2>
      <div className="weeknav">
        <button onClick={() => goWeek(-1)}>‹ poprzedni</button>
        <strong>{weekLabel(monday)}</strong>
        <button onClick={() => goWeek(1)}>następny ›</button>
      </div>

      <table className="cal">
        <thead>
          <tr>
            <th></th>
            {days.map((d, i) => (
              <th key={i}>
                {DAY_LABELS[i]}
                <br />
                <span className="muted">
                  {pad2(d.getDate())}.{pad2(d.getMonth() + 1)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HOURS.map((h) => (
            <tr key={h}>
              <td className="hour">{pad2(h)}:00</td>
              {days.map((d, i) => {
                const res = cellFor(d, h);
                const mine = !!res && res.userId === session?.user?.id;
                const cls = res ? (mine ? "slot busy mine" : "slot busy") : "slot";
                const label = `${DAY_LABELS[i]} ${pad2(h)}:00 ${
                  res ? (mine ? "Twoja rezerwacja, kliknij aby odwołać" : "zajęte") : "wolny slot"
                }`;
                return (
                  <td key={i}>
                    <button
                      type="button"
                      className={cls}
                      disabled={!!res && !mine}
                      title={res?.title ?? undefined}
                      aria-label={label}
                      onClick={() => onCellClick(d, h, res)}
                    >
                      {res ? (mine ? (res.title ?? "✓ Twoja") : "zajęte") : ""}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {book.error && <p className="error">{book.error.message}</p>}

      <h2>Rezerwacja na dowolny zakres</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const title = (fd.get("title") as string) || undefined;
          book.mutate({
            resourceId,
            start: new Date(String(fd.get("start"))),
            end: new Date(String(fd.get("end"))),
            title,
          });
          e.currentTarget.reset();
        }}
      >
        <input type="datetime-local" name="start" required aria-label="początek" />
        <input type="datetime-local" name="end" required aria-label="koniec" />
        <input name="title" placeholder="tytuł (opcjonalnie)" aria-label="tytuł" />
        <button disabled={book.isPending}>Zarezerwuj</button>
      </form>

      <p className="muted">id: {r.id}</p>
    </div>
  );
}
