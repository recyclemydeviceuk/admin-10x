import { getSessionUser, can } from '@/lib/auth';
import { backendFetch } from '@/lib/backend';

// =========================================================
// Product image/video uploads, from the product editor.
//
// The file is forwarded to the 10X API, which validates it and
// stores it on S3, returning an ABSOLUTE url that goes into the
// product record.
//
// It deliberately does NOT write to this app's disk. The
// storefront is a separate app on a separate origin: a relative
// path like /uploads/x.png would resolve against the
// storefront's domain and 404, so the photo would never appear
// on the site — and it would vanish on the next deploy or land
// on only one node of a multi-node panel.
// =========================================================

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !can(user, 'products.media')) {
    return Response.json({ ok: false, message: 'Your role can’t upload product media.' }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json({ ok: false, message: 'No file received.' }, { status: 400 });
  }

  // Rebuilt rather than forwarded whole: the incoming form may carry fields
  // the API has no use for, and this keeps the contract explicit.
  const outbound = new FormData();
  outbound.append('file', file, file.name);

  let response: Response;
  try {
    response = await backendFetch('/api/v1/admin/media', {
      method: 'POST',
      headers: { 'x-actor-name': user.name },
      body: outbound,
      cache: 'no-store',
    });
  } catch {
    return Response.json(
      { ok: false, message: 'Can’t reach the 10X API — the file was not uploaded.' },
      { status: 503 },
    );
  }

  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    asset?: { url: string };
  };

  if (!response.ok || !body.asset?.url) {
    return Response.json(
      { ok: false, message: body.message ?? 'The upload was refused.' },
      { status: response.status || 502 },
    );
  }

  return Response.json({ ok: true, message: 'Uploaded.', asset: body.asset });
}
