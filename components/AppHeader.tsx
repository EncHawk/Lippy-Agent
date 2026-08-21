import Link from "next/link";

export function AppHeader() {
  return (
    <header className="app-header">
      <Link href="/" className="app-brand"><span className="app-brand-mark">L</span><span>LIPPY</span></Link>
      <nav className="app-nav-links" aria-label="Primary navigation">
        <a href="/#failure-modes">Product</a>
        <a href="/#integrations">Docs</a>
        <Link href="/dashboard" className="app-nav-active">Control room <span>↗</span></Link>
      </nav>
    </header>
  );
}
