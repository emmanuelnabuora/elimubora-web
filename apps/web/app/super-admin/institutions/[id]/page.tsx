import Link from 'next/link';
import { apiFetch } from '../../../../lib/api-client';
import { KENYA_COUNTY_CODE_TO_NAME } from '../../../../lib/kenya-counties';

interface AdminContact { id: string; fullName: string; email: string; role: string; joinedAt: string; }
interface PendingInvite { id: string; email: string; role: string; expiresAt: string; createdAt: string; }
interface ClassStreamGroup { gradeLevel: string; academicYear: number; streamNames: string[]; streamCount: number; }

interface InstitutionOverview {
  id: string; name: string; slug: string; kind: string;
  countyCode: string | null; nemisCode: string | null; status: string; createdAt: string;
  settings: Record<string, unknown>;
  enrollment: { students: number; teachers: number; parents: number; schoolAdmins: number; principals: number };
  adminContacts: AdminContact[];
  pendingAdminInvites: PendingInvite[];
  classStreams: ClassStreamGroup[];
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div style={{ fontSize: 12, color: '#98a2b3', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#1f2437' }}>{value}</div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: '#f6f7fc', borderRadius: 14, padding: '14px 18px' }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#1f2437' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6b7285' }}>{label}</div>
    </div>
  );
}
