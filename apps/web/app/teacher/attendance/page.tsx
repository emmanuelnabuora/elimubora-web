import { apiFetch } from '../../../lib/api-client';
import { ClassDateSelector } from './ClassDateSelector';
import { AttendanceMarker } from './AttendanceMarker';

interface ClassStream {
  id: string;
  name: string;
  gradeLevel: string;
}

interface StudentListItem {
  studentId: string;
  fullName: string;
  classStreamId: string | null;
  status: string;
}

interface AttendanceRecord {
  learnerId: string;
  status: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function AttendancePage({
  searchParams
}: {
  searchParams: Promise<{ classStreamId?: string; date?: string }>;
}) {
  const params = await searchParams;
  const classStreamId = params.classStreamId;
  const date = params.date ?? today();

  const [classStreams, students] = await Promise.all([
    apiFetch<ClassStream[]>('/v1/class-streams'),
    apiFetch<StudentListItem[]>('/v1/students')
  ]);

  const roster = classStreamId
    ? students.filter((s) => s.classStreamId === classStreamId && s.status === 'active')
    : [];

  const existing = classStreamId
    ? await apiFetch<AttendanceRecord[]>(`/v1/attendance/class/${classStreamId}?date=${date}`)
    : [];
  const existingByLearner = Object.fromEntries(existing.map((r) => [r.learnerId, r.status]));

  return (
    <div>
      <h1 className="admin-page-title">Attendance</h1>

      <div className="admin-section">
        <ClassDateSelector classStreams={classStreams} selectedClassStreamId={classStreamId} date={date} />

        {classStreamId &&
          (roster.length === 0 ? (
            <p className="admin-empty" style={{ marginTop: 'var(--eb-space-4)' }}>
              No active students in this class.
            </p>
          ) : (
            <AttendanceMarker
              classStreamId={classStreamId}
              date={date}
              roster={roster.map((s) => ({
                studentId: s.studentId,
                fullName: s.fullName,
                existingStatus: existingByLearner[s.studentId] ?? 'present'
              }))}
            />
          ))}
      </div>
    </div>
  );
}
