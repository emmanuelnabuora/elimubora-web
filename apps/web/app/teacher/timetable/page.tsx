import { getCurrentUser } from '../../../lib/get-current-user';
import { apiFetch } from '../../../lib/api-client';

interface TimetableSlot {
  id: string;
  courseId: string;
  roomId: string;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
  className: string | null;
  gradeLevel: string | null;
}

interface Course {
  id: string;
  title: string;
}

interface Room {
  id: string;
  name: string;
}

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export default async function TeacherTimetablePage() {
  const result = await getCurrentUser();
  const teacherId = result!.user.id;

  const [slots, courses, rooms] = await Promise.all([
    apiFetch<TimetableSlot[]>(`/v1/timetable/teacher/${teacherId}?academicYear=${new Date().getFullYear()}`),
    apiFetch<Course[]>('/v1/courses'),
    apiFetch<Room[]>('/v1/rooms')
  ]);

  const courseTitle = (id: string) => courses.find((c) => c.id === id)?.title ?? 'Unknown course';
  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? 'Unknown room';

  return (
    <div>
      <h1 className="admin-page-title">My Timetable</h1>

      <div className="admin-section">
        {slots.length === 0 ? (
          <p className="admin-empty">No timetable slots assigned yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Time</th>
                <th>Course</th>
                <th>Class</th>
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
                    <td>
                      {s.className ?? '—'} {s.gradeLevel ? `(${s.gradeLevel})` : ''}
                    </td>
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
