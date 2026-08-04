import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '../../../../../../lib/api-client';

/** Proxies POST /v1/invoices/:id/payments/mpesa/initiate — the real sandbox gateway. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
): Promise<NextResponse> {
  const { invoiceId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }
  try {
    const payment = await apiFetch(`/v1/invoices/${invoiceId}/payments/mpesa/initiate`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return NextResponse.json(payment, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('M-Pesa initiate route: unexpected error', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}
