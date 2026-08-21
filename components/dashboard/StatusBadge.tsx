const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  healthy: { label: "Healthy", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  degraded: { label: "Degraded", className: "bg-amber-100 text-amber-800 border-amber-300" },
  healing: { label: "Healing", className: "bg-blue-100 text-blue-800 border-blue-300" },
  broken: { label: "Broken", className: "bg-red-100 text-red-800 border-red-300" },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.degraded!;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {style.label}
    </span>
  );
}
