import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '../components/ui/index.js';
import { useAuth } from '../context/AuthContext.jsx';

// Catch-all for unknown routes. Previously any unmatched path silently
// redirected to "/" (the marketing page) with no explanation — a logged-in
// user who mistyped an in-app URL landed on the public site. This renders a
// real "page not found" and points back to the right place for who's asking.
export default function NotFound() {
  const { isAuthed } = useAuth();
  const home = isAuthed ? '/app/dashboard' : '/';
  const homeLabel = isAuthed ? 'Back to dashboard' : 'Back to home';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
        <Compass size={26} />
      </span>
      <p className="font-display text-5xl font-extrabold text-fg">404</p>
      <h1 className="mt-3 font-display text-xl font-bold text-fg">This page doesn't exist</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        The link may be broken or the page may have moved. Check the URL, or head back.
      </p>
      <Button as={Link} to={home} className="mt-6">{homeLabel}</Button>
    </div>
  );
}
