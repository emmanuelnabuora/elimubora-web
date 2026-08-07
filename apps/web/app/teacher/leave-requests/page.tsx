import { getCurrentUser } from '../../../lib/get-current-user';
import { apiFetch } from '../../../lib/api-client';
import { SubmitLeaveRequestForm } from '../../../components/SubmitLeaveRequestForm';

interface LeaveRequestItem {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
}

export default async function TeacherLeaveRequestsPage() {
  const result = await getCurrentUser();
  const userId = result!.user.id;
  const requests = await apiFetch<LeaveRequestItem[]>(`/v1/leave-requests/staff/${userId}`);

  return (
    <div>
      <h1 className="admin-page-title">Leave Requests</h1>

      <div className="admin-section">
        <h2 className="admin-section-title">Request leave</h2>
        <SubmitLeaveRequestForm />
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Your requests</h2>
        {requests.length === 0 ? (
          <p className="admin-empty">You haven&rsquo;t submitted any leave requests yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Dates</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td style={{ textTransform: 'capitalize' }}>{r.leaveType}</td>
                  <td>
                    {r.startDate} &rarr; {r.endDate}
                  </td>
                  <td>{r.reason ?? '—'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
