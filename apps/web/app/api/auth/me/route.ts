import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, cookieOptions } from '../../../../lib/auth-cookies';
import { getCurrentUser } from '../../../../lib/get-current-user';

export async function GET(): Promise<NextResponse> {
  const result = await getCurrentUser();
  if (!result) {
    return NextResponse.json({ message: 'Not signed in.' }, { status: 401 });
  }

  const res = NextResponse.json(result.user);
  if (result.refreshed) {
    res.cookies.set(ACCESS_COOKIE, result.refreshed.accessToken, cookieOptions(result.refreshed.expiresInSeconds));
    res.cookies.set(REFRESH_COOKIE, result.refreshed.refreshToken, cookieOptions(60 * 60 * 24 * 30));
  }
  return res;
}
