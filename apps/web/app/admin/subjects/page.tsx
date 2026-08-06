import { apiFetch } from '../../../lib/api-client';
import { CreateCourseForm } from '../../../components/CreateCourseForm';
import { CsvImportForm } from '../../../components/CsvImportForm';
import { AddCommonSubjectsForm } from '../../../components/AddCommonSubjectsForm';

interface Course {
  id: string;
  title: string;
  learningArea: string;
  gradeLevel: string;
  status: string;
}

interface ClassStream {
  gradeLevel: string;
}

export default async function SubjectsPage() {
  const [courses, classStreams] = await Promise.all([
    apiFetch<Course[]>('/v1/courses'),
    apiFetch<ClassStream[]>('/v1/class-streams')
  ]);
  const gradeLevelsWithClasses = [...new Set(classStreams.map((c) => c.gradeLevel))].sort();

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

      <div className="admin-section">
        <h2 className="admin-section-title">Create a course</h2>
        <CreateCourseForm />
        <div style={{ marginTop: 12 }}>
          <AddCommonSubjectsForm gradeLevelsWithClasses={gradeLevelsWithClasses} />
        </div>
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Import courses from CSV</h2>
        <CsvImportForm
          endpoint="/api/admin/courses/import"
          columns={['title', 'learningArea', 'gradeLevel', 'description']}
          sampleRow={['Mathematics', 'Mathematics', 'G4', 'Core mathematics for Grade 4']}
        />
      </div>

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
