import { apiFetch, ApiError } from '../../../../../lib/api-client';
import { ExamTakingForm } from '../../../../../components/ExamTakingForm';

interface QuestionOption {
  id: string;
  text: string;
}

interface QuestionForLearner {
  id: string;
  questionType: 'mcq' | 'short_answer' | 'essay';
  prompt: string;
  options: QuestionOption[] | null;
  marks: string;
}

export default async function ExamAttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;

  let questions: QuestionForLearner[];
  let loadError: string | null = null;
  try {
    questions = await apiFetch<QuestionForLearner[]>(`/v1/exam-attempts/${attemptId}/questions`);
  } catch (err) {
    questions = [];
    loadError = err instanceof ApiError ? err.message : 'Could not load this exam attempt.';
  }

  if (loadError) {
    return (
      <div className="admin-section">
        <p className="auth-error">{loadError}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">Exam</h1>
      <div className="admin-section">
        <ExamTakingForm attemptId={attemptId} questions={questions} />
      </div>
    </div>
  );
}
