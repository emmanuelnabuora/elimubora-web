import { apiFetch } from '../../../lib/api-client';
import { ClassStreamSelector } from './ClassStreamSelector';
import { AddTimetableSlotForm } from './AddTimetableSlotForm';
import { CreateClassStreamForm } from '../../../components/CreateClassStreamForm';
import { CreateRoomForm } from '../../../components/CreateRoomForm';

interface ClassStream {
  id: string;
  name: string;
  gradeLevel: string;
  academicYear: number;
}

interface Course {
  id: string;
  title: string;
  gradeLevel: string;
}

interface Room {
  id: string;
  name: string;
}

interface TenantUser {
  userId: string;
  fullName: string;
  role: string;
}

interface TimetableSlot {
  id: string;
  courseId: string;
  teacherId: string;
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

export default async function TimetablePage({
  searchParams
}: {
  searchParams: Promise<{ classStreamId?: string }>;
}) {
  const { classStreamId } = await searchParams;

  const [classStreams, courses, rooms, users] = await Promise.all([
    apiFetch<ClassStream[]>('/v1/class-streams'),
    apiFetch<Course[]>('/v1/courses'),
    apiFetch<Room[]>('/v1/rooms'),
    apiFetch<TenantUser[]>('/v1/users?limit=100')
  ]);
  const teachers = users.filter((u) => u.role === 'teacher');

  const slots = classStreamId
    ? await apiFetch<TimetableSlot[]>(`/v1/timetable/class/${classStreamId}?academicYear=${new Date().getFullYear()}`)
    : [];

  const courseTitle = (id: string) => courses.find((c) => c.id === id)?.title ?? id;
  const teacherName = (id: string) => teachers.find((t) => t.userId === id)?.fullName ?? id;
  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? id;

  return (
    <div>
      <h1 className="admin-page-title">Timetable</h1>

      <div className="admin-section">
        <h2 className="admin-section-title">Create a class</h2>
        <CreateClassStreamForm />
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Create a room</h2>
        <CreateRoomForm />
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">View a class's schedule</h2>
        <ClassStreamSelector classStreams={classStreams} selected={classStreamId} />

        {classStreamId &&
          (slots.length === 0 ? (
            <p className="admin-empty" style={{ marginTop: 'var(--eb-space-4)' }}>
              No timetable slots for this class yet.
            </p>
          ) : (
            <table className="data-table" style={{ marginTop: 'var(--eb-space-4)' }}>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Course</th>
                  <th>Teacher</th>
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
                      <td>{teacherName(s.teacherId)}</td>
                      <td>{roomName(s.roomId)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ))}
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Add a timetable slot</h2>
        <AddTimetableSlotForm
          classStreams={classStreams}
          courses={courses}
          rooms={rooms}
          teachers={teachers.map((t) => ({ id: t.userId, fullName: t.fullName }))}
          defaultClassStreamId={classStreamId}
        />
      </div>
    </div>
  );
}
