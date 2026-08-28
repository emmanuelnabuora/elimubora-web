import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { API_BASE_URL } from '../../../../../../lib/auth-cookies';

/** Proxies POST /v1/auth/mfa/setup/enroll — starts mandatory TOTP setup for a platform_admin. */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }
  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE_URL}/v1/auth/mfa/setup/enroll`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error('MFA setup enroll route: failed to reach upstream API', API_BASE_URL, err);
    return NextResponse.json(
      { message: 'Could not reach the authentication service. Please try again shortly.' },
      { status: 502 }
    );
  }
  let data: Record<string, unknown>;
  try {
    data = await upstream.json();
  } catch (err) {
    console.error('MFA setup enroll route: upstream response was not valid JSON', err);
    return NextResponse.json(
      { message: 'The authentication service returned an unexpected response.' },
      { status: 502 }
    );
  }
  // The backend only returns the raw otpauthUrl -- rendering it as a
  // scannable QR code is purely a display concern, so it happens here
  // in the frontend proxy rather than adding an image-generation
  // dependency to the API. Best-effort: if QR generation fails for any
  // reason, the setup flow still works via the text otpauthUrl the
  // frontend already falls back to for manual entry.
  if (upstream.ok && typeof data.otpauthUrl === 'string') {
    try {
      const qrDataUrl = await QRCode.toDataURL(data.otpauthUrl, { margin: 1, width: 240 });
      return NextResponse.json({ ...data, qrDataUrl }, { status: upstream.status });
    } catch (err) {
      console.error('MFA setup enroll route: QR code generation failed', err);
    }
  }
  return NextResponse.json(data, { status: upstream.status });
}
