import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-primary">QA Guardian</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Enterprise-Grade Quality Assurance Automation Platform
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          to="/login"
          className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90"
        >
          Login
        </Link>
        <Link
          to="/register"
          className="rounded-md border border-primary px-6 py-3 font-medium text-primary hover:bg-primary/10"
        >
          Register
        </Link>
      </div>
    </div>
  );
}
