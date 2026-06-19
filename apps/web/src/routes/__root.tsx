import { createRootRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { authClient, useSession } from "../lib/auth-client";

export const Route = createRootRoute({ component: RootLayout });

function RootLayout() {
  const { data: session } = useSession();
  const navigate = useNavigate();

  return (
    <>
      <header>
        <Link to="/resources">
          <strong>Atrium</strong>
        </Link>
        {session ? (
          <span>
            <Link to="/my-reservations">Moje rezerwacje</Link>{" "}
            <span className="muted">{session.user.email}</span>{" "}
            <button
              onClick={async () => {
                await authClient.signOut();
                navigate({ to: "/login" });
              }}
            >
              Wyloguj
            </button>
          </span>
        ) : (
          <Link to="/login">Zaloguj</Link>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
