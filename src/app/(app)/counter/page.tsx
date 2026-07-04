import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { CounterConsole } from "@/components/counter-console";
import { PendingCheckins } from "@/components/pending-checkins";
import { InstallHint } from "@/components/install-hint";

/**
 * The pocket screen: what a barista at the till or a waiter at the table
 * opens all shift. One code box, one confirm tap, plus the live queue.
 * Works for every guest code — check-ins and welcome gifts alike.
 */
export default async function CounterPage() {
  const session = await requireSession();
  const business = await db.business.findUnique({
    where: { id: session.businessId },
    select: { name: true },
  });

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-5 text-center">
        <h1 className="f-display text-2xl font-semibold tracking-tight text-ink">
          Counter<span className="text-ink">.</span>
        </h1>
        <p className="mt-0.5 text-sm text-ink-faint">
          {business?.name} · confirm guest codes
        </p>
      </div>

      <Card>
        <CardBody className="pt-5">
          <CounterConsole big />
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Waiting to be confirmed"
          description="Check-ins from guests in the room right now"
        />
        <CardBody>
          <PendingCheckins big />
        </CardBody>
      </Card>

      <p className="mt-6 text-center text-xs text-ink-faint">
        Guest shows a code → check it → hand over / confirm. Points credit on
        your tap.
      </p>
      <InstallHint />
    </div>
  );
}
