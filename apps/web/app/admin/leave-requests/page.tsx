import { apiFetch } from '../../../lib/api-client';
import { LeaveRequestsTable } from './LeaveRequestsTable';

interface LeaveRequestItem {
  id: string;
  staffId: string;
  staffName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
}

export default async function LeaveRequestsPage() {
  const leaveRequests = await apiFetch<LeaveRequestItem[]>('/v1/leave-requests/pending');

  return (
    <div>
      <h1 className="admin-page-title">Leave Requests</h1>
      <div className="admin-section">
        <h2 className="admin-section-title">Awaiting a decision ({leaveRequests.length})</h2>
        <LeaveRequestsTable initialRequests={leaveRequests} />
      </div>
    </div>
  );
}
