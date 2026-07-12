
// Loading placeholder. Composable primitives (Text/Circle/Rect) plus a couple
// of ready-made shapes for the most common loading states in the app.
export function Skeleton({ className = '', style }) {
  return <div className={`animate-pulse rounded-lg bg-tint/[0.08] ${className}`} style={style} />;
}

export function SkeletonText({ lines = 1, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      </div>
      <Skeleton className="mt-4 h-24 w-full" />
    </div>
  );
}

export default Skeleton;
