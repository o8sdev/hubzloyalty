import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ReviewFlow } from "./review-flow";

/**
 * PUBLIC QR landing page — this is what guests see after scanning the code
 * on the counter. Mobile-first, minimal chrome (root layout only, no app
 * shell), no auth.
 */
export default async function PublicReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const business = await db.business.findUnique({
    where: { slug },
    select: {
      name: true,
      logoUrl: true,
      googleReviewUrl: true,
      suspendedAt: true,
    },
  });
  if (!business || business.suspendedAt) notFound();

  return (
    <main className="flex min-h-screen flex-col items-center bg-slate-50 px-4 py-10">
      <div className="flex w-full max-w-md flex-1 flex-col items-center">
        {business.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- owner-supplied external URL; next/image needs domain config
          <img
            src={business.logoUrl}
            alt={business.name}
            className="h-16 w-16 rounded-full border border-slate-200 bg-white object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-700 text-2xl font-bold text-white">
            {business.name.charAt(0).toUpperCase()}
          </div>
        )}
        <p className="mt-3 text-sm font-medium text-slate-500">
          {business.name}
        </p>
        <h1 className="mt-1 text-center text-2xl font-bold text-slate-900">
          How was your visit today?
        </h1>

        <ReviewFlow
          slug={slug}
          businessName={business.name}
          googleReviewUrl={business.googleReviewUrl}
        />
      </div>

      <footer className="mt-10 text-xs text-slate-400">
        Powered by LoyaltyCRM
      </footer>
    </main>
  );
}
