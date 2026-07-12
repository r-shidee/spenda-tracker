import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <span className="text-2xl">🔒</span>
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Access Denied</h1>
        <p className="text-muted-foreground">
          You are not authorized to access this application. If you believe
          this is an error, please contact the administrator.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
      >
        Go Back
      </Link>
    </div>
  );
}
