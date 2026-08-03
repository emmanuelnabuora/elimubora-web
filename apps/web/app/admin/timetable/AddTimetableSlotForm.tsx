'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' }
];

export function AddTimetableSlotForm({
  classStreams,
  courses,
  rooms,
  teachers,
  defaultClassStreamId
}: {
  classStreams: Array<{ id: string; name: string; academicYear: number }>;
  courses: Array<{ id: string; title: string }>;
  rooms: Array<{ id: string; name: string }>;
  teachers: Array<{ id: string; fullName: string }>;
  defaultClassStreamId?: string;
}) {
  const router = useRouter();
  const [classStreamId, setClassStreamId] = useState(defaultClassStreamId ?? '');
  const [courseId, setCourseId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    const stream = classStreams.find((c) => c.id === classStreamId);
    try {
      const res = await fetch('/api/admin/timetable', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          classStreamId,
          courseId,
          teacherId,
          roomId,
          academicYear: stream?.academicYear ?? new Date().getFullYear(),
          dayOfWeek,
          startTime,
          endTime
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not create that slot. Try again.');
        return;
      }
      setSuccess('Timetable slot added.');
      router.push(`/admin/timetable?classStreamId=${classStreamId}`);
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Class</span>
          <select value={classStreamId} onChange={(e) => setClassStreamId(e.target.value)} required>
            <option value="" disabled>
              Select a class
            </option>
            {classStreams.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>Course</span>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} required>
            <option value="" disabled>
              Select a course
            </option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Teacher</span>
          <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} required>
            <option value="" disabled>
              Select a teacher
            </option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>Room</span>
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)} required>
            <option value="" disabled>
              Select a room
            </option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="admin-form-row">
        <label className="admin-field">
          <span>Day</span>
          <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} required>
            {DAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <div className="admin-form-row" style={{ marginBottom: 0 }}>
          <label className="admin-field">
            <span>Start</span>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </label>
          <label className="admin-field">
            <span>End</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
          </label>
        </div>
      </div>
      {error && <p className="auth-error">{error}</p>}
      {success && (
        <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
          {success}
        </p>
      )}
      <button type="submit" className="admin-submit" disabled={loading}>
        {loading ? 'Adding…' : 'Add slot'}
      </button>
    </form>
  );
}
