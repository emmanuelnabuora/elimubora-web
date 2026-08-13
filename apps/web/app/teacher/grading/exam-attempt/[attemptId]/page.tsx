import Link from 'next/link';
import { apiFetch } from '../../../../../lib/api-client';
import { GradeAttemptForm } from './GradeAttemptForm';

interface QuestionOption {
  id: string;
  text: string;
}

interface Question {
  id: string;
  questionType: 'mcq' | 'short_answer' | 'essay';
  prompt: string;
  options: QuestionOption[] | null;
  correctOptionId: string | null;
  marks: string;
}

interface AttemptReview {
  attempt: {
    id: string;
    learnerName: string | null;
    answers: Record<string, string>;
    status: string;
    autoScore: string;
    manualScore: string;
    finalScore: string;
  };
  questions: Question[];
}

function optionText(question: Question, optionId: string | undefined): string {
  if (!optionId) return '—';
  return question.options?.find((o) => o.id === optionId)?.text ?? optionId;
}

export default async function ExamAttemptReviewPage({
  params
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const { attempt, questions } = await apiFetch<AttemptReview>(`/v1/exam-attempts/${attemptId}/review`);

  const nonMcqTotal = questions
    .filter((q) => q.questionType !== 'mcq')
    .reduce((sum, q) => sum + Number(q.marks), 0);

  return (
    <div>
      <h1 className="admin-page-title">Grade attempt</h1>
      <p className="dashboard-subhead" style={{ marginBottom: 'var(--eb-space-4)' }}>
        {attempt.learnerName ?? 'Unknown student'}
      </p>

      <div className="admin-section">
        <h2 className="admin-section-title">Questions and answers</h2>
        <div style={{ display: 'grid', gap: 16 }}>
          {questions.map((q, i) => {
            const learnerAnswer = attempt.answers[q.id];
            const isMcq = q.questionType === 'mcq';
            const isCorrect = isMcq && learnerAnswer === q.correctOptionId;
            return (
              <div key={q.id} style={{ borderBottom: '1px solid var(--eb-line)', paddingBottom: 12 }}>
                <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 6px' }}>
                  {i + 1}. {q.prompt}{' '}
                  <span style={{ fontWeight: 400, color: 'var(--eb-fg-muted)' }}>({q.marks} marks)</span>
                </p>
                {isMcq ? (
                  <p style={{ fontSize: 13, margin: 0 }}>
                    Answered: {optionText(q, learnerAnswer)}{' '}
                    <span
                      className={`status-pill ${isCorrect ? 'active' : 'inactive'}`}
                      style={{ marginLeft: 6 }}
                    >
                      {isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </p>
                ) : (
                  <p style={{ fontSize: 13, margin: 0, whiteSpace: 'pre-wrap' }}>
                    {learnerAnswer || <span style={{ color: 'var(--eb-fg-muted)' }}>No answer given</span>}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Score</h2>
        <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: -4 }}>
          Auto-graded (MCQ): {attempt.autoScore} marks. Short-answer/essay questions above are worth up to{' '}
          {nonMcqTotal} marks combined — enter your total for those below.
        </p>
        {attempt.status === 'graded' ? (
          <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)' }}>
            Already graded: {attempt.manualScore} manual marks, {attempt.finalScore} final score.
          </p>
        ) : (
          <GradeAttemptForm attemptId={attempt.id} maxManualScore={nonMcqTotal} />
        )}
      </div>

      <Link href="/teacher/grading" className="admin-nav-link">
        &larr; Back to grading
      </Link>
    </div>
  );
}
