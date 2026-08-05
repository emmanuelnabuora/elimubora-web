import { getCurrentUser } from '../../../lib/get-current-user';
import { apiFetch } from '../../../lib/api-client';
import { AddOwnTimetableSlotForm } from './AddOwnTimetableSlotForm';

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

interface ClassStream {
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
  const academicYear = new Date().getFullYear();

  const [slots, courses, rooms, classStreams] = await Promise.all([
    apiFetch<TimetableSlot[]>(`/v1/timetable/teacher/${teacherId}?academicYear=${academicYear}`),
    apiFetch<Course[]>('/v1/courses'),
    apiFetch<Room[]>('/v1/rooms'),
    apiFetch<ClassStream[]>('/v1/class-streams')
  ]);

  const courseTitle = (id: string) => courses.find((c) => c.id === id)?.title ?? 'Unknown course';
  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? 'Unknown room';

  return (
    <div>
      <h1 className="admin-page-title">My Timetable</h1>

      <div className="admin-section">
        <h2 className="admin-section-title">Add a slot to my schedule</h2>
        <AddOwnTimetableSlotForm
          teacherId={teacherId}
          classStreams={classStreams}
          courses={courses}
          rooms={rooms}
          academicYear={academicYear}
        />
      </div>

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
