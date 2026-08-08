import Link from 'next/link';
import { apiFetch } from '../../../lib/api-client';
import { StartAttemptButton } from '../../../components/StartAttemptButton';

interface MyAttempt {
  id: string;
  status: 'in_progress' | 'submitted' | 'graded';
  finalScore: string;
}

interface ExamItem {
  id: string;
  title: string;
  durationMinutes: number;
  questionCount: number;
  myAttempt: MyAttempt | null;
}

export default async function StudentExamsPage() {
  const exams = await apiFetch<ExamItem[]>('/v1/exams/mine');

  return (
    <div>
      <h1 className="admin-page-title">Exams</h1>

      <div className="admin-section">
        {exams.length === 0 ? (
          <p className="admin-empty">No exams are open for you right now.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Exam</th>
                <th>Duration</th>
                <th>Questions</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {exams.map((e) => (
                <tr key={e.id}>
                  <td>{e.title}</td>
                  <td>{e.durationMinutes} min</td>
                  <td>{e.questionCount}</td>
                  <td>
                    {!e.myAttempt ? (
                      <StartAttemptButton examId={e.id} />
                    ) : e.myAttempt.status === 'in_progress' ? (
                      <Link
                        href={`/student/exams/attempt/${e.myAttempt.id}`}
                        className="admin-submit"
                        style={{ display: 'inline-block', padding: '8px 16px', fontSize: 13 }}
                      >
                        Continue
                      </Link>
                    ) : e.myAttempt.status === 'submitted' ? (
                      <span style={{ color: 'var(--eb-fg-muted)', fontSize: 13 }}>Awaiting grading</span>
                    ) : (
                      <strong>{e.myAttempt.finalScore} marks</strong>
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
