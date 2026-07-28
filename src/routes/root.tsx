import { Link, Outlet, useNavigation } from 'react-router';

export default function RootLayout() {
  const navigation = useNavigation();
  const isNavigating = navigation.state === 'loading';

  return (
    <div className="min-h-screen">
      <nav className="flex items-center gap-6 border-b px-6 py-4">
        <Link to="/" className="text-lg font-semibold">
          run-deck
        </Link>
        <div className="flex gap-4 text-sm">
          <Link to="/" className="text-muted-foreground transition-colors hover:text-foreground">
            Home
          </Link>
          <Link
            to="/about"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            About
          </Link>
        </div>
      </nav>
      {isNavigating && (
        <div className="border-b bg-muted px-6 py-2 text-sm text-muted-foreground">Loading...</div>
      )}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
