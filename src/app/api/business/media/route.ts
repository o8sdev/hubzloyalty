import { after } from "next/server";
import { db } from "@/lib/db";
import {
  badRequest,
  forbidden,
  json,
  requireApiSession,
  serverError,
} from "@/lib/http";
import { uploadBusinessImage, deleteBusinessImage } from "@/lib/storage";
import { actorFromSession, recordAudit } from "@/lib/audit";

// Owner venue media: main photo (Business.coverImageUrl), logo
// (Business.logoUrl), and a capped gallery (BusinessPhoto[]).

const GALLERY_CAP = 8;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  if (auth.session.role !== "OWNER" && auth.session.role !== "ADMIN") {
    return forbidden();
  }
  const { businessId } = auth.session;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest("Expected an image upload");
  }
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "");
  if (!(file instanceof File)) return badRequest("No file provided");
  if (!["cover", "logo", "gallery"].includes(kind)) {
    return badRequest("Invalid photo kind");
  }
  if (!TYPES.includes(file.type)) return badRequest("Use a JPEG, PNG, or WebP image");
  if (file.size > MAX_BYTES) return badRequest("Image must be under 5 MB");

  try {
    if (kind === "gallery") {
      const count = await db.businessPhoto.count({ where: { businessId } });
      if (count >= GALLERY_CAP) {
        return badRequest(`Gallery is full (max ${GALLERY_CAP}) — remove one first`);
      }
    }

    const url = await uploadBusinessImage(businessId, file);
    const actor = actorFromSession(auth.session);

    if (kind === "cover") {
      const prev = await db.business.findUnique({
        where: { id: businessId },
        select: { coverImageUrl: true },
      });
      await db.business.update({
        where: { id: businessId },
        data: { coverImageUrl: url },
      });
      if (prev?.coverImageUrl) after(() => deleteBusinessImage(prev.coverImageUrl!));
      after(() =>
        recordAudit({ businessId, actor, action: "settings.media", summary: "Updated venue main photo", targetType: "business", targetId: businessId })
      );
      return json({ url });
    }

    if (kind === "logo") {
      const prev = await db.business.findUnique({
        where: { id: businessId },
        select: { logoUrl: true },
      });
      await db.business.update({
        where: { id: businessId },
        data: { logoUrl: url },
      });
      if (prev?.logoUrl) after(() => deleteBusinessImage(prev.logoUrl!));
      after(() =>
        recordAudit({ businessId, actor, action: "settings.media", summary: "Updated venue logo", targetType: "business", targetId: businessId })
      );
      return json({ url });
    }

    const max = await db.businessPhoto.aggregate({
      where: { businessId },
      _max: { position: true },
    });
    const photo = await db.businessPhoto.create({
      data: { businessId, url, position: (max._max.position ?? -1) + 1 },
      select: { id: true, url: true, caption: true },
    });
    after(() =>
      recordAudit({ businessId, actor, action: "settings.media", summary: "Added a venue photo", targetType: "business", targetId: businessId })
    );
    return json({ photo });
  } catch (err) {
    console.error("media upload failed", err);
    return serverError("Could not upload the image");
  }
}

export async function DELETE(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  if (auth.session.role !== "OWNER" && auth.session.role !== "ADMIN") {
    return forbidden();
  }
  const { businessId } = auth.session;

  const body = (await req.json().catch(() => null)) as {
    kind?: string;
    photoId?: string;
  } | null;

  try {
    if (body?.kind === "cover") {
      const prev = await db.business.findUnique({
        where: { id: businessId },
        select: { coverImageUrl: true },
      });
      await db.business.update({ where: { id: businessId }, data: { coverImageUrl: null } });
      if (prev?.coverImageUrl) after(() => deleteBusinessImage(prev.coverImageUrl!));
      return json({ ok: true });
    }
    if (body?.kind === "logo") {
      const prev = await db.business.findUnique({
        where: { id: businessId },
        select: { logoUrl: true },
      });
      await db.business.update({ where: { id: businessId }, data: { logoUrl: null } });
      if (prev?.logoUrl) after(() => deleteBusinessImage(prev.logoUrl!));
      return json({ ok: true });
    }
    if (body?.kind === "gallery" && body.photoId) {
      const photo = await db.businessPhoto.findFirst({
        where: { id: body.photoId, businessId },
        select: { id: true, url: true },
      });
      if (!photo) return badRequest("Photo not found");
      await db.businessPhoto.delete({ where: { id: photo.id } });
      after(() => deleteBusinessImage(photo.url));
      return json({ ok: true });
    }
    return badRequest("Invalid delete request");
  } catch (err) {
    console.error("media delete failed", err);
    return serverError("Could not remove the image");
  }
}
