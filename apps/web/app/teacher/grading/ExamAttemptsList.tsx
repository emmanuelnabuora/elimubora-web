import Link from 'next/link';

interface ExamAttemptSummary {
  id: string;
  learnerName: string | null;
  status: string;
  autoScore: string;
  manualScore: string;
  finalScore: string;
}

export function ExamAttemptsList({ attempts }: { attempts: ExamAttemptSummary[] }) {
  if (attempts.length === 0) {
    return <p className="admin-empty">No one has attempted this exam yet.</p>;
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Student</th>
          <th>Status</th>
          <th>Score</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {attempts.map((a) => (
          <tr key={a.id}>
            <td>{a.learnerName ?? '—'}</td>
            <td>
              <span
                className={`status-pill ${a.status === 'graded' ? 'active' : a.status === 'submitted' ? 'pending' : 'inactive'}`}
              >
                {a.status.replace('_', ' ')}
              </span>
            </td>
            <td>{a.status === 'in_progress' ? '—' : a.finalScore}</td>
            <td>
              {a.status === 'submitted' && (
                <Link href={`/teacher/grading/exam-attempt/${a.id}`} className="admin-nav-link" style={{ padding: '4px 8px' }}>
                  Grade &rarr;
                </Link>
              )}
              {a.status === 'graded' && (
                <Link
                  href={`/teacher/grading/exam-attempt/${a.id}`}
                  className="admin-nav-link"
                  style={{ padding: '4px 8px' }}
                >
                  Review
                </Link>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
