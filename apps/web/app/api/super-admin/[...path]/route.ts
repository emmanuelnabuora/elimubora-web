import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../lib/api-client';

/**
 * Every /api/super-admin/* request forwards to the real backend at
 * /v1/platform-admin/*, preserving query string and JSON body.
 * All 5 platform-admin backend modules (statistics/institutions,
 * access control, business/billing, AI governance/analytics, and
 * incident/recovery command) share this one route rather than each
 * getting its own near-identical BFF file — the actual authorization
 * decision lives entirely in the backend (@Roles('platform_admin') +
 * @CurrentUser() from a verified JWT), so this proxy adds no security
 * logic of its own; it only forwards an already-authenticated
 * session's request and relays whatever the backend decides.
 */
async function proxy(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
  method: 'GET' | 'POST' | 'PATCH'
): Promise<NextResponse> {
  const { path } = await params;
  const backendPath = `/v1/platform-admin/${path.join('/')}`;
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
    console.error('Super-admin proxy route: unexpected error', backendPath, err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

export async function GET(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, ctx, 'GET');
}

export async function POST(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, ctx, 'POST');
}

export async function PATCH(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, ctx, 'PATCH');
}
