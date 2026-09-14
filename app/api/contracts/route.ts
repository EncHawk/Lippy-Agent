import { requireUser } from "@/lib/auth/service";
import { createContract, listContracts } from "@/lib/contracts/service";
import { endpoint, body } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) { return endpoint(async () => Response.json({ contracts: await listContracts(await requireUser(req)) })); }
export async function POST(req: Request) { return endpoint(async () => {
  const owner = await requireUser(req);
  return Response.json({ contract: await createContract(await body(req), owner) }, { status: 201 });
}); }
