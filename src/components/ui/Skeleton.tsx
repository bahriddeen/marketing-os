export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[0.625rem] bg-canvas-soft ${className}`}
    />
  );
}
