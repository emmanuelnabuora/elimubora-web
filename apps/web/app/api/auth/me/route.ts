import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/get-current-user';

export async function GET(): Promise<NextResponse> {
  const result = await getCurrentUser();
  if (!result) {
    return NextResponse.json({ message: 'Not signed in.' }, { status: 401 });
  }

  return NextResponse.json(result.user);
}
