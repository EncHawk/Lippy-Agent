import { ContractListSkeleton } from "@/components/dashboard/Skeletons";

/**
 * Instant navigation feedback for /dashboard. Without this, clicking a
 * Link to a dynamic route shows the old page frozen until the server
 * component resolves — with a remote DB that reads as "multiple seconds
 * of nothing." A loading.tsx sibling lets the App Router swap the shell
 * in immediately and stream the real content in behind it.
 */
export default function DashboardLoading() {
  return <ContractListSkeleton />;
}
