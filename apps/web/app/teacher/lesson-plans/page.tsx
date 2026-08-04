import { apiFetch } from '../../../lib/api-client';
import { LessonPlanCourseSelector } from './LessonPlanCourseSelector';
import { LessonPlansList } from './LessonPlansList';
import { CreateLessonPlanForm } from './CreateLessonPlanForm';

interface CourseSummary {
  courseId: string;
  title: string;
}

interface LessonPlan {
  id: string;
  weekOf: string;
  objectives: string | null;
  resources: string | null;
  status: string;
  aiGenerated: boolean;
}

export default async function LessonPlansPage({
  searchParams
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const { courseId } = await searchParams;

  const dashboard = await apiFetch<{ courses: CourseSummary[] }>('/v1/teacher/dashboard');
  const plans = courseId ? await apiFetch<LessonPlan[]>(`/v1/lesson-plans/course/${courseId}`) : [];

  return (
    <div>
      <h1 className="admin-page-title">Lesson Plans</h1>

      <div className="admin-section">
        <LessonPlanCourseSelector courses={dashboard.courses} selected={courseId} />
      </div>

      {courseId && (
        <>
          <div className="admin-section">
            <h2 className="admin-section-title">Plans ({plans.length})</h2>
            {plans.length === 0 ? (
              <p className="admin-empty">No lesson plans for this course yet.</p>
            ) : (
              <LessonPlansList plans={plans} />
            )}
          </div>

          <div className="admin-section">
            <h2 className="admin-section-title">Add a lesson plan</h2>
            <CreateLessonPlanForm courseId={courseId} />
          </div>
        </>
      )}
    </div>
  );
}
