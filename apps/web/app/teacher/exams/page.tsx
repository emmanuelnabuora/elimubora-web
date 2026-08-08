import Link from 'next/link';
import { apiFetch } from '../../../lib/api-client';
import { CreateQuestionBankForm } from '../../../components/CreateQuestionBankForm';
import { CreateExamForm } from '../../../components/CreateExamForm';
import { ExamStatusControl } from '../../../components/ExamStatusControl';

interface Bank {
  id: string;
  title: string;
  subject: string;
  gradeLevel: string;
}

interface ExamItem {
  id: string;
  title: string;
  status: string;
  durationMinutes: number;
  questionCount: number;
}

interface CourseSummary {
  courseId: string;
  title: string;
}

export default async function TeacherExamsPage() {
  const [banks, exams, dashboard] = await Promise.all([
    apiFetch<Bank[]>('/v1/question-banks'),
    apiFetch<ExamItem[]>('/v1/exams'),
    apiFetch<{ courses: CourseSummary[] }>('/v1/teacher/dashboard')
  ]);

  return (
    <div>
      <h1 className="admin-page-title">Exams</h1>

      <div className="admin-section">
        <h2 className="admin-section-title">Question banks</h2>
        {banks.length === 0 ? (
          <p className="admin-empty">No question banks yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Subject</th>
                <th>Grade</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {banks.map((b) => (
                <tr key={b.id}>
                  <td>{b.title}</td>
                  <td>{b.subject}</td>
                  <td>{b.gradeLevel}</td>
                  <td>
                    <Link href={`/teacher/exams/banks/${b.id}`} className="admin-nav-link" style={{ padding: '5px 12px', fontSize: 12 }}>
                      Manage questions
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 12 }}>
          <CreateQuestionBankForm />
        </div>
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Exams</h2>
        {exams.length === 0 ? (
          <p className="admin-empty">No exams created yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Duration</th>
                <th>Questions</th>
                <th>Status</th>
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
                    <ExamStatusControl examId={e.id} status={e.status} />
                  </td>
                  <td>
                    <Link href={`/teacher/exams/${e.id}`} className="admin-nav-link" style={{ padding: '5px 12px', fontSize: 12 }}>
                      View attempts
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 12 }}>
          <CreateExamForm courses={dashboard.courses} banks={banks} />
        </div>
      </div>
    </div>
  );
}
