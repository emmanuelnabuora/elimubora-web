import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../lib/api-client';

/** Proxies GET /v1/tenants/platform-stats — platform-wide user/school aggregate counts, platform_admin-only. */
export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await apiFetch('/v1/tenants/platform-stats'));
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Platform stats route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}
