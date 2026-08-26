import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../../lib/api-client';

/**
 * Every /api/admin/school-applications/* request forwards to
 * /v1/admin/school-applications/*, preserving query string and JSON
 * body -- same shape as the super-admin catch-all proxy
 * (api/super-admin/[...path]/route.ts), just pointed at this
 * feature's own backend prefix instead of /v1/platform-admin.
 * Authorization is entirely the backend's job (@Roles('platform_admin')
 * + @CurrentUser() from a verified JWT, via apiFetch's session token);
 * this proxy adds no security logic of its own.
 */
async function proxy(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
  method: 'GET' | 'POST'
): Promise<NextResponse> {
  const { path } = await params;
  // Optional catch-all: GET /api/admin/school-applications itself
  // (the list endpoint) has no trailing segment at all, unlike
  // /:id, /:id/approve, /:id/reject -- path is undefined in that
  // case, not an empty array.
  const backendPath = `/v1/admin/school-applications${path?.length ? `/${path.join('/')}` : ''}`;
  const search = new URL(request.url).search;

  let body: string | undefined;
  if (method !== 'GET') {
    try {
      body = await request.text();
    } catch {
      return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
    }
  }

  try {
    const result = await apiFetch(`${backendPath}${search}`, {
      method,
      body: body && body.length > 0 ? body : undefined
    });
    return NextResponse.json(result ?? {});
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('School applications admin proxy route: unexpected error', backendPath, err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

export async function GET(request: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, ctx, 'GET');
}

export async function POST(request: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, ctx, 'POST');
}
