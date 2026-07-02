import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { RunDigestButton } from "./run-digest-button";

function CheckBadge({ ok, okLabel, failLabel }: { ok: boolean; okLabel: string; failLabel: string }) {
  return ok ? (
    <Badge className="border-green-200 bg-green-50 text-green-700">{okLabel}</Badge>
  ) : (
    <Badge className="border-red-200 bg-red-50 text-red-700">{failLabel}</Badge>
  );
}

/** Hostname of a connection string, without leaking credentials. */
function dbHost(url: string | undefined): string {
  if (!url) return "not set";
  try {
    return new URL(url).hostname;
  } catch {
    return "unparseable";
  }
}

export default async function AdminSystemPage() {
  await requirePlatformAdmin();

  // Live DB check with latency.
  let dbOk = false;
  let dbLatencyMs: number | null = null;
  try {
    const started = Date.now();
    await db.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - started;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const [rateLimitRows, emailRows, resetTokens] = dbOk
    ? await Promise.all([
        db.rateLimit.count(),
        db.emailLog.count(),
        db.passwordResetToken.count({ where: { usedAt: null } }),
      ])
    : [0, 0, 0];

  const env = {
    databaseUrl: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL,
    sessionSecret: Boolean(process.env.SESSION_SECRET),
    resendKey: Boolean(process.env.RESEND_API_KEY),
    mailFrom: process.env.MAIL_FROM,
    cronSecret: Boolean(process.env.CRON_SECRET),
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  };

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-right text-sm font-medium text-slate-900">{value}</span>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="System"
        description="Connections, configuration, and operations."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Connections" />
          <CardBody className="divide-y divide-slate-100 p-0">
            {row(
              "Postgres (Supabase)",
              <span className="flex items-center justify-end gap-2">
                <span className="font-mono text-xs text-slate-500">
                  {dbHost(env.databaseUrl)}
                </span>
                <CheckBadge
                  ok={dbOk}
                  okLabel={`connected · ${dbLatencyMs}ms`}
                  failLabel="unreachable"
                />
              </span>
            )}
            {row(
              "Migrations (direct URL)",
              <CheckBadge
                ok={Boolean(env.directUrl)}
                okLabel="configured"
                failLabel="DIRECT_URL missing"
              />
            )}
            {row(
              "Resend (email)",
              env.resendKey ? (
                <CheckBadge ok okLabel="API key set" failLabel="" />
              ) : (
                <Badge className="border-amber-300 bg-amber-50 text-amber-700">
                  dev mode — emails logged, not sent
                </Badge>
              )
            )}
            {row("Mail from", env.mailFrom ?? "onboarding@resend.dev (default)")}
            {row(
              "Session secret",
              <CheckBadge ok={env.sessionSecret} okLabel="set" failLabel="MISSING" />
            )}
            {row(
              "Cron secret",
              <CheckBadge ok={env.cronSecret} okLabel="set" failLabel="MISSING" />
            )}
            {row("App URL", env.appUrl ?? "not set")}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Housekeeping counters" />
          <CardBody className="divide-y divide-slate-100 p-0">
            {row("Rate-limit buckets", rateLimitRows)}
            {row("Email log rows", emailRows)}
            {row("Outstanding reset tokens", resetTokens)}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Operations"
            description="The digest normally runs Mondays 08:00 UTC via Vercel cron (vercel.json)."
          />
          <CardBody>
            <RunDigestButton />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
