const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  healthy: { label: "Healthy", className: "status-healthy" },
  degraded: { label: "Degraded", className: "status-degraded" },
  healing: { label: "Healing", className: "status-healing" },
  broken: { label: "Broken", className: "status-broken" },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.degraded!;
  return (
    <span className={`status-badge ${style.className}`}>
      <span className="status-dot" />
      {style.label}
    </span>
  );
}
