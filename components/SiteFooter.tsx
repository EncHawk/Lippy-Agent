import Link from "next/link";

const sections = [
  ["Overview", "#hero"],
  ["Drift", "#failure-modes"],
  ["Pipeline", "#pipeline"],
  ["Interfaces", "#integrations"],
  ["Foundation", "#foundation"],
];

export function SiteFooter({ className = "", absolute = false }: { className?: string; absolute?: boolean }) {
  const prefix = absolute ? "" : "/";

  return (
    <footer className={`global-footer ${absolute ? "global-footer-absolute" : ""} ${className}`}>
      <div className="footer-brand"><span className="footer-mark">L</span><span>LIPPY</span></div>
      <nav className="footer-links" aria-label="Page sections">
        {sections.map(([label, hash]) => <a key={label} href={`${prefix}${hash}`}>{label}</a>)}
      </nav>
      <div className="footer-meta"><Link href="/dashboard">Control room <span>↗</span></Link><span>LIPPY © 2026</span></div>
    </footer>
  );
}
