import { apiFetch } from '../../../lib/api-client';

interface MyProfile {
  classStreamId: string | null;
  className: string | null;
}

interface Course {
  id: string;
  title: string;
}

interface Room {
  id: string;
  name: string;
}

interface TimetableSlot {
  id: string;
  courseId: string;
  roomId: string;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
}

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export default async function MyTimetablePage() {
  const profile = await apiFetch<MyProfile>('/v1/students/me');

  if (!profile.classStreamId) {
    return (
      <div>
        <h1 className="admin-page-title">My Timetable</h1>
        <p className="admin-empty">You&rsquo;re not assigned to a class yet — check with your school office.</p>
      </div>
    );
  }

  const [courses, rooms, slots] = await Promise.all([
    apiFetch<Course[]>('/v1/courses'),
    apiFetch<Room[]>('/v1/rooms'),
    apiFetch<TimetableSlot[]>(`/v1/timetable/class/${profile.classStreamId}?academicYear=${new Date().getFullYear()}`)
  ]);

  const courseTitle = (id: string) => courses.find((c) => c.id === id)?.title ?? 'Unknown course';
  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? 'Unknown room';

  return (
    <div>
      <h1 className="admin-page-title">My Timetable</h1>
      <p style={{ color: 'var(--eb-fg-muted)', fontSize: 14, marginTop: -16, marginBottom: 'var(--eb-space-6)' }}>
        {profile.className}
      </p>

      <div className="admin-section">
        {slots.length === 0 ? (
          <p className="admin-empty">No timetable published for your class yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Time</th>
                <th>Course</th>
                <th>Room</th>
              </tr>
            </thead>
            <tbody>
              {slots
                .slice()
                .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMin - b.startMin)
                .map((s) => (
                  <tr key={s.id}>
                    <td>{DAY_NAMES[s.dayOfWeek]}</td>
                    <td>
                      {minutesToTime(s.startMin)}&ndash;{minutesToTime(s.endMin)}
                    </td>
                    <td>{courseTitle(s.courseId)}</td>
                    <td>{roomName(s.roomId)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
