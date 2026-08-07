import { getCurrentUser } from '../../../lib/get-current-user';
import { apiFetch } from '../../../lib/api-client';
import { TransfersTable } from '../../../components/TransfersTable';

interface TransferItem {
  id: string;
  fromTenantId: string;
  toTenantId: string;
  studentName: string | null;
  fromTenantName: string;
  toTenantName: string;
  status: string;
  reason: string | null;
}

export default async function TransfersPage() {
  const result = await getCurrentUser();
  const myTenantId = result!.user.activeTenantId;
  const transfers = await apiFetch<TransferItem[]>('/v1/transfers');

  return (
    <div>
      <h1 className="admin-page-title">Transfers</h1>
      <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: -12, marginBottom: 'var(--eb-space-6)' }}>
        Requests to move a student between this school and another. To request a transfer, open the student&rsquo;s
        own profile page.
      </p>
      <div className="admin-section">
        <TransfersTable initialTransfers={transfers} myTenantId={myTenantId} />
      </div>
    </div>
  );
}
