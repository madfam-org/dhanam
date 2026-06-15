export default function LandingLoading() {
  return (
    <div
      className="landing-root min-h-screen bg-gradient-to-b from-background via-background to-muted/20"
      role="status"
      aria-live="polite"
      aria-label="Loading Dhanam landing page"
    >
      <div className="container mx-auto px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 rounded-md bg-muted animate-pulse" />
          <div className="hidden md:flex gap-3">
            <div className="h-9 w-16 rounded-md bg-muted animate-pulse" />
            <div className="h-9 w-20 rounded-md bg-muted animate-pulse" />
            <div className="h-9 w-24 rounded-md bg-muted animate-pulse" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-16 md:py-24 max-w-4xl mx-auto space-y-6">
        <div className="h-8 w-48 mx-auto rounded-full bg-muted animate-pulse" />
        <div className="h-14 w-full rounded-lg bg-muted animate-pulse" />
        <div className="h-6 w-3/4 mx-auto rounded-md bg-muted animate-pulse" />
        <div className="h-6 w-1/2 mx-auto rounded-md bg-muted animate-pulse" />
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <div className="h-11 w-40 mx-auto rounded-md bg-muted animate-pulse" />
          <div className="h-11 w-44 mx-auto rounded-md bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  );
}
