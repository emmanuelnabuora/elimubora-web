import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../../../lib/api-client';

/** Proxies GET /v1/question-banks/:id/questions (list) and POST (add manually). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bankId: string }> }
): Promise<NextResponse> {
  const { bankId } = await params;
  try {
    return NextResponse.json(await apiFetch(`/v1/question-banks/${bankId}/questions`));
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Bank questions route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bankId: string }> }
): Promise<NextResponse> {
  const { bankId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }
  try {
    const result = await apiFetch(`/v1/question-banks/${bankId}/questions`, { method: 'POST', body: JSON.stringify(body) });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('Bank questions route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}
