import { apiFetch } from '../../../../lib/api-client';
import { GradeAttemptForm } from '../../../../components/GradeAttemptForm';

interface AttemptItem {
  id: string;
  learnerId: string;
  learnerName: string | null;
  status: string;
  autoScore: string;
  manualScore: string;
  finalScore: string;
  submittedAt: string | null;
}

interface Exam {
  id: string;
  title: string;
}

export default async function ExamAttemptsPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const [exam, attempts] = await Promise.all([
    apiFetch<Exam>(`/v1/exams/${examId}`),
    apiFetch<AttemptItem[]>(`/v1/exams/${examId}/attempts`)
  ]);

  return (
    <div>
      <h1 className="admin-page-title">{exam.title} \u2014 Attempts</h1>

      <div className="admin-section">
        {attempts.length === 0 ? (
          <p className="admin-empty">No one has attempted this exam yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Learner</th>
                <th>Status</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id}>
                  <td>{a.learnerName ?? <span style={{ color: 'var(--eb-fg-muted)' }}>Unknown learner</span>}</td>
                  <td style={{ textTransform: 'capitalize' }}>{a.status.replace('_', ' ')}</td>
                  <td>
                    {a.status === 'submitted' ? (
                      <GradeAttemptForm attemptId={a.id} autoScore={a.autoScore} />
                    ) : a.status === 'graded' ? (
                      <strong>{a.finalScore}</strong>
                    ) : (
                      <span style={{ color: 'var(--eb-fg-muted)' }}>In progress</span>
                    )}
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
