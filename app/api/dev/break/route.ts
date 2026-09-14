import { z } from "zod";
import { requireUser } from "@/lib/auth/service";
import { getContract } from "@/lib/contracts/service";
import { mutateFixture, type Fixture } from "@/lib/fixtures/scraper";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/errors";
import { endpoint, body } from "@/lib/http";
export async function POST(req: Request) { return endpoint(async () => {
  if (env.NODE_ENV === "production") throw new HttpError(404, "NOT_FOUND", "Not found");
  const owner = await requireUser(req);
  const input = z.object({ contractId: z.string(), scenario: z.enum(["layout", "value", "unrepairable"]).default("layout"), field: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/).optional(), value: z.string().optional() }).parse(await body(req));
  await getContract(input.contractId, owner);
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Contract" WHERE id = ${input.contractId} FOR UPDATE`;
    const c = await tx.contract.findUniqueOrThrow({ where: { id: input.contractId } });
    if (c.provider !== "fixture" || !c.fixture) throw new HttpError(400, "NOT_FIXTURE", "This contract does not use fixtures");
    if (c.activeRunId) throw new HttpError(409, "RUN_IN_PROGRESS", "Wait for the current run before editing the fixture");
    const fixture = mutateFixture(JSON.parse(c.fixture) as Fixture, input.scenario, input.field, input.value);
    await tx.contract.update({ where: { id: c.id }, data: { fixture: JSON.stringify(fixture) } });
  });
  return Response.json({ applied: true });
}); }
