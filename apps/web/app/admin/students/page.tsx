import { apiFetch } from '../../../lib/api-client';
import { AddStudentForm } from './AddStudentForm';

interface StudentListItem {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  status: string;
  className: string | null;
  gradeLevel: string | null;
}

interface ClassStream {
  id: string;
  name: string;
  gradeLevel: string;
  academicYear: number;
}

export default async function StudentsPage() {
  const [students, classStreams] = await Promise.all([
    apiFetch<StudentListItem[]>('/v1/students'),
    apiFetch<ClassStream[]>('/v1/class-streams')
  ]);

  return (
    <div>
      <h1 className="admin-page-title">Students</h1>

      <div className="admin-section">
        <h2 className="admin-section-title">Enrol a new student</h2>
        <AddStudentForm classStreams={classStreams} />
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">All students ({students.length})</h2>
        {students.length === 0 ? (
          <p className="admin-empty">No students enrolled yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Admission #</th>
                <th>Class</th>
                <th>Grade</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.studentId}>
                  <td>{s.fullName}</td>
                  <td>{s.admissionNumber}</td>
                  <td>{s.className ?? '—'}</td>
                  <td>{s.gradeLevel ?? '—'}</td>
                  <td>
                    <span className={`status-pill ${s.status === 'active' ? 'active' : 'inactive'}`}>
                      {s.status.replace('_', ' ')}
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
