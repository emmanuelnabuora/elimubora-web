import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../lib/api-client';

/** Proxies GET /v1/conversations (list mine) and POST /v1/conversations (start one, staff-only). */
export async function GET(): Promise<NextResponse> {
  try {
    const conversations = await apiFetch('/v1/conversations');
    return NextResponse.json(conversations);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Conversations route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }
  try {
    const result = await apiFetch('/v1/conversations', { method: 'POST', body: JSON.stringify(body) });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Conversations route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}
