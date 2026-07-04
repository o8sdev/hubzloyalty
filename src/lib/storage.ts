import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Business venue media. Uploads go through the SERVICE-ROLE client (bypasses
// storage RLS) into the public `business-media` bucket, keyed by business id.
// The bucket is public-read, so getPublicUrl gives a durable display URL.
// ---------------------------------------------------------------------------

const BUCKET = "business-media";
const PUBLIC_MARKER = `/object/public/${BUCKET}/`;

/** Upload an image for a business; returns its public URL. */
export async function uploadBusinessImage(
  businessId: string,
  file: File
): Promise<string> {
  const ext =
    (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") ||
    "jpg";
  const key = `${businessId}/${randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const admin = supabaseAdmin();
  const { error } = await admin.storage.from(BUCKET).upload(key, bytes, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(error.message);

  return admin.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
}

/** Best-effort delete of a previously uploaded image by its public URL. */
export async function deleteBusinessImage(url: string): Promise<void> {
  const idx = url.indexOf(PUBLIC_MARKER);
  if (idx === -1) return;
  const key = decodeURIComponent(url.slice(idx + PUBLIC_MARKER.length));
  await supabaseAdmin().storage.from(BUCKET).remove([key]);
}
