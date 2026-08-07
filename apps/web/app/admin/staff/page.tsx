import { apiFetch } from '../../../lib/api-client';
import { InviteStaffForm } from './InviteStaffForm';
import { InvitationsTable } from './InvitationsTable';
import { EditStaffNameAction } from '../../../components/EditStaffNameAction';

interface TenantUser {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  membershipStatus: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

const STAFF_ROLES = new Set(['teacher', 'school_admin', 'principal']);

export default async function StaffPage() {
  const [users, invitations] = await Promise.all([
    apiFetch<TenantUser[]>('/v1/users?limit=100'),
    apiFetch<Invitation[]>('/v1/users/invitations')
  ]);

  const staff = users.filter((u) => STAFF_ROLES.has(u.role));
  const pendingInvitations = invitations.filter((i) => !i.acceptedAt && !i.revokedAt);

  return (
    <div>
      <h1 className="admin-page-title">Staff</h1>

      <div className="admin-section">
        <h2 className="admin-section-title">Invite a new staff member</h2>
        <InviteStaffForm />
      </div>

      {pendingInvitations.length > 0 && (
        <div className="admin-section">
          <h2 className="admin-section-title">Pending invitations ({pendingInvitations.length})</h2>
          <InvitationsTable invitations={pendingInvitations} />
        </div>
      )}

      <div className="admin-section">
        <h2 className="admin-section-title">All staff ({staff.length})</h2>
        {staff.length === 0 ? (
          <p className="admin-empty">No staff members yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((u) => (
                <tr key={u.userId}>
                  <td>
                    <EditStaffNameAction userId={u.userId} fullName={u.fullName} />
                  </td>
                  <td>{u.email}</td>
                  <td style={{ textTransform: 'capitalize' }}>{u.role.replace('_', ' ')}</td>
                  <td>
                    <span className={`status-pill ${u.membershipStatus === 'active' ? 'active' : 'inactive'}`}>
                      {u.membershipStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
