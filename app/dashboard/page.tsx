import { ContractList } from "@/components/dashboard/ContractList";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function DashboardPage() {
  return (
    <main className="app-shell">
      <div className="app-frame">
        <AppHeader />
        <div className="app-page-heading">
          <div>
            <p className="app-eyebrow"><i /> CONTROL ROOM / 01</p>
            <h1>Contracts</h1>
            <p className="app-description">Every contract you&apos;ve defined, with its current health and a link into the detail view.</p>
          </div>
          <a href="/" className="app-back-link">← Home</a>
        </div>
        <section className="app-panel-list" aria-label="Contracts">
          <ContractList />
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
