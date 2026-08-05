import Link from 'next/link';
import { apiFetch } from '../../../lib/api-client';
import { AddStudentForm } from './AddStudentForm';
import { CreateClassStreamForm } from '../../../components/CreateClassStreamForm';

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

export default async function StudentsPage({
  searchParams
}: {
  searchParams: Promise<{ applicationId?: string; fullName?: string; gradeLevel?: string; parentFullName?: string }>;
}) {
  const params = await searchParams;
  const [students, classStreams] = await Promise.all([
    apiFetch<StudentListItem[]>('/v1/students'),
    apiFetch<ClassStream[]>('/v1/class-streams')
  ]);

  return (
    <div>
      <h1 className="admin-page-title">Students</h1>

      <div className="admin-section">
        <h2 className="admin-section-title">Classes</h2>
        {classStreams.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: 0, marginBottom: 12 }}>
            No classes exist yet — you&rsquo;ll need at least one before you can enrol a student.
          </p>
        )}
        <CreateClassStreamForm />
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">
          {params.applicationId ? `Enrol ${params.fullName ?? 'this candidate'}` : 'Enrol a new student'}
        </h2>
        {params.applicationId && (
          <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: 0, marginBottom: 12 }}>
            Pre-filled from their admitted application — confirm the details below and submit to complete their
            enrollment.
          </p>
        )}
        <AddStudentForm
          classStreams={classStreams}
          initialValues={{
            applicationId: params.applicationId,
            fullName: params.fullName,
            gradeLevel: params.gradeLevel,
            parentFullName: params.parentFullName
          }}
        />
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
                  <td>
                    <Link href={`/admin/students/${s.studentId}`} style={{ color: 'var(--eb-primary)', fontWeight: 600 }}>
                      {s.fullName}
                    </Link>
                  </td>
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
