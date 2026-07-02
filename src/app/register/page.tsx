import { redirect } from "next/navigation";

// Self-serve registration is retired — onboarding is invite-only via demo
// requests. Old links and bookmarks land on the request form instead.
export default function RegisterPage() {
  redirect("/request-demo");
}
