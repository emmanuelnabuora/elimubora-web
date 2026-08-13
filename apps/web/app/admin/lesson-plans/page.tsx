import { apiFetch } from '../../../lib/api-client';
import { LessonPlanReviewTable } from './LessonPlanReviewTable';

interface PendingLessonPlan {
  id: string;
  weekOf: string;
  objectives: string | null;
  resources: string | null;
  status: string;
  aiGenerated: boolean;
  courseTitle: string;
  teacherName: string;
}

export default async function AdminLessonPlansPage() {
  const plans = await apiFetch<PendingLessonPlan[]>('/v1/lesson-plans/pending');

  return (
    <div>
      <h1 className="admin-page-title">Lesson Plans</h1>
      <div className="admin-section">
        <h2 className="admin-section-title">Awaiting approval ({plans.length})</h2>
        <LessonPlanReviewTable initialPlans={plans} />
      </div>
    </div>
  );
}
