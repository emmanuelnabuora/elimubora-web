import { apiFetch } from '../../../lib/api-client';

interface Course {
  id: string;
  title: string;
  learningArea: string;
  gradeLevel: string;
  status: string;
}

export default async function SubjectsPage() {
  const courses = await apiFetch<Course[]>('/v1/courses');

  const bySubject = new Map<string, Course[]>();
  for (const c of courses) {
    const list = bySubject.get(c.learningArea) ?? [];
    list.push(c);
    bySubject.set(c.learningArea, list);
  }
  const subjects = Array.from(bySubject.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <h1 className="admin-page-title">Subjects</h1>

      {subjects.length === 0 ? (
        <p className="admin-empty">No courses exist yet — subjects are grouped from your courses' learning areas.</p>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {subjects.map(([subject, subjectCourses]) => (
            <div key={subject} className="admin-section">
              <h2 className="admin-section-title">
                {subject} ({subjectCourses.length})
              </h2>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Grade</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectCourses
                    .slice()
                    .sort((a, b) => a.gradeLevel.localeCompare(b.gradeLevel))
                    .map((c) => (
                      <tr key={c.id}>
                        <td>{c.title}</td>
                        <td>{c.gradeLevel}</td>
                        <td>
                          <span className={`status-pill ${c.status === 'published' ? 'active' : 'pending'}`}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
