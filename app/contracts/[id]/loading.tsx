import { ContractDetailSkeleton } from "@/components/dashboard/Skeletons";

/** Instant navigation feedback for /contracts/[id] while the DB resolves. */
export default function ContractDetailLoading() {
  return <ContractDetailSkeleton />;
}
