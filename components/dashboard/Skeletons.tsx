/**
 * Skeletons used by the loading.tsx route files. Kept in one component
 * file so the shimmer styling lives in exactly one place.
 */
export function ContractListSkeleton() {
  return (
    <main className="app-shell"><div className="app-frame app-loading-frame">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-description" />
      <ul className="skeleton-list">
        {[0, 1, 2].map((i) => (
          <li key={i}>
            <div>
              <div className="skeleton skeleton-row-title" />
              <div className="skeleton skeleton-row-id" />
            </div>
            <div className="skeleton skeleton-badge" />
          </li>
        ))}
      </ul>
    </div></main>
  );
}

export function ContractDetailSkeleton() {
  return (
    <main className="app-shell"><div className="app-frame app-loading-frame">
      <div className="skeleton skeleton-back" />
      <div className="skeleton-detail-header">
        <div>
          <div className="skeleton skeleton-detail-title" />
          <div className="skeleton skeleton-detail-meta" />
        </div>
        <div>
          <div className="skeleton skeleton-badge" />
          <div className="skeleton skeleton-run-button" />
        </div>
      </div>
      <div className="skeleton-detail-grid">
        <div className="skeleton-panel">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-line">
              <div className="skeleton skeleton-field" />
              <div className="skeleton skeleton-value" />
            </div>
          ))}
        </div>
        <div className="skeleton skeleton-event-panel" />
      </div>
      <div className="skeleton skeleton-history-panel" />
    </div></main>
  );
}
