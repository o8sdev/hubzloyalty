import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import {
  createClient,
  type SupabaseClient,
  type User as SupabaseAuthUser,
} from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Supabase Auth wiring. Identity (credentials, sessions, reset emails) lives
// in auth.users; the domain User table is the linked profile and stays the
// source of truth for tenancy facts. Those facts are MIRRORED into
// auth.users.app_metadata (see AuthClaims) so a verified access token is
// enough to authorize a request without a DB read. Every write to a
// claims-bearing profile field must go through syncAuthClaims().
// ---------------------------------------------------------------------------

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Claims mirrored into auth.users.app_metadata. */
export type AuthClaims = {
  /** Domain User.id (cuid) — what the app calls userId. */
  profileId: string;
  businessId: string; // "" for platform-only accounts
  role: string;
  platformAdmin: boolean;
  mustChangePassword: boolean;
};

export function buildClaims(user: {
  id: string;
  businessId: string | null;
  role: string;
  isPlatformAdmin: boolean;
  mustChangePassword: boolean;
}): AuthClaims {
  return {
    profileId: user.id,
    businessId: user.businessId ?? "",
    role: user.role,
    platformAdmin: user.isPlatformAdmin,
    mustChangePassword: user.mustChangePassword,
  };
}

export function claimsFromAuthUser(user: SupabaseAuthUser): AuthClaims | null {
  const meta = user.app_metadata as Partial<AuthClaims> | undefined;
  if (!meta || typeof meta.profileId !== "string" || meta.profileId === "") {
    return null; // auth user without a linked profile — treat as no session
  }
  return {
    profileId: meta.profileId,
    businessId: typeof meta.businessId === "string" ? meta.businessId : "",
    role: typeof meta.role === "string" ? meta.role : "OWNER",
    platformAdmin: meta.platformAdmin === true,
    mustChangePassword: meta.mustChangePassword === true,
  };
}

/**
 * Request-scoped client bound to the caller's cookies (App Router).
 * Use for signIn/signOut/updateUser/verifyOtp on behalf of the visitor.
 */
export async function supabaseServer(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component (read-only cookies) — the
            // middleware refresh handles cookie writes there.
          }
        },
      },
    }
  );
}

/** Service-role client for admin operations (create/update/delete users). */
let adminClient: SupabaseClient | null = null;
export function supabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(
      env("NEXT_PUBLIC_SUPABASE_URL"),
      env("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return adminClient;
}

/**
 * Push a profile's authorization facts into auth.users.app_metadata.
 * Call after ANY write to businessId / role / isPlatformAdmin /
 * mustChangePassword. Existing sessions pick the change up on their next
 * token refresh (≤1h); logins see it immediately.
 */
export async function syncAuthClaims(user: {
  id: string;
  authId: string | null;
  businessId: string | null;
  role: string;
  isPlatformAdmin: boolean;
  mustChangePassword: boolean;
}): Promise<void> {
  if (!user.authId) return;
  const { error } = await supabaseAdmin().auth.admin.updateUserById(user.authId, {
    app_metadata: buildClaims(user),
  });
  if (error) {
    throw new Error(`syncAuthClaims failed for ${user.id}: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Verified-user lookup with a small in-memory cache. The project signs
// tokens with HS256 (shared secret we don't hold), so authenticity requires
// auth.getUser() — a network round-trip. Caching token → user for a few
// minutes keeps request auth fast; the cap bounds memory. If the project is
// later switched to asymmetric signing keys, supabase-js verifies locally
// and this cache simply stops mattering.
// ---------------------------------------------------------------------------

const VERIFY_TTL_MS = 5 * 60 * 1000;
const VERIFY_CACHE_MAX = 500;
const verifiedTokens = new Map<string, { user: SupabaseAuthUser; expires: number }>();

export async function getVerifiedAuthUser(): Promise<SupabaseAuthUser | null> {
  const supabase = await supabaseServer();
  // Cheap cookie read (no network, unverified) just to key the cache.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return null;

  const cached = verifiedTokens.get(token);
  if (cached && cached.expires > Date.now()) return cached.user;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    verifiedTokens.delete(token);
    return null;
  }

  if (verifiedTokens.size >= VERIFY_CACHE_MAX) {
    const oldest = verifiedTokens.keys().next().value;
    if (oldest) verifiedTokens.delete(oldest);
  }
  verifiedTokens.set(token, { user, expires: Date.now() + VERIFY_TTL_MS });
  return user;
}

/** Drop a token from the verified cache (call on password change/sign-out). */
export function invalidateVerifiedAuthUser(token?: string) {
  if (token) verifiedTokens.delete(token);
  else verifiedTokens.clear();
}
