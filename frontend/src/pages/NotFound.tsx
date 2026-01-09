import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div className="absolute inset-0 chart-grid opacity-20" />
      <div className="absolute -top-20 right-10 h-64 w-64 rounded-full bg-primary/20 blur-[120px]" />
      <div className="absolute bottom-10 left-10 h-64 w-64 rounded-full bg-accent/20 blur-[120px]" />
      <div className="surface-card relative z-10 mx-4 max-w-lg px-8 py-10 text-center">
        <div className="text-6xl font-bold tracking-tight">404</div>
        <p className="mt-3 text-lg text-muted-foreground">This route doesn’t exist yet.</p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-full border border-border bg-secondary px-5 py-2 text-sm font-semibold text-foreground hover:bg-secondary/70"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
