'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

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

export function ExamTakingForm({ attemptId, questions }: { attemptId: string; questions: QuestionForLearner[] }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const answeredCount = Object.values(answers).filter((v) => v.trim().length > 0).length;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/exam-attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Could not submit your answers. Try again.');
        setConfirming(false);
        return;
      }
      router.push('/student/exams');
      router.refresh();
    } catch {
      setError('Could not reach the server. Your answers have not been submitted \u2014 please try again.');
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (questions.length === 0) {
    return <p className="admin-empty">No questions found for this attempt.</p>;
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: 0 }}>
        {answeredCount} of {questions.length} answered
      </p>
      <div style={{ display: 'grid', gap: 20 }}>
        {questions.map((q, i) => (
          <div key={q.id} style={{ border: '1px solid var(--eb-line)', borderRadius: 16, padding: 16 }}>
            <p style={{ margin: '0 0 12px', fontWeight: 600 }}>
              {i + 1}. {q.prompt}{' '}
              <span style={{ fontWeight: 400, color: 'var(--eb-fg-muted)', fontSize: 13 }}>({q.marks} marks)</span>
            </p>
            {q.questionType === 'mcq' && q.options ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {q.options.map((o) => (
                  <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400, fontSize: 14 }}>
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id] === o.id}
                      onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
                    />
                    {o.text}
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                rows={q.questionType === 'essay' ? 6 : 3}
                style={{
                  width: '100%',
                  fontFamily: 'var(--eb-font-body)',
                  fontSize: 14,
                  padding: '10px 14px',
                  borderRadius: 16,
                  border: '1px solid var(--eb-line)',
                  boxSizing: 'border-box'
                }}
              />
            )}
          </div>
        ))}
      </div>

      {error && <p className="auth-error">{error}</p>}

      {!confirming ? (
        <button type="button" className="admin-submit" style={{ marginTop: 20 }} onClick={() => setConfirming(true)}>
          Submit exam
        </button>
      ) : (
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 14 }}>
            You&rsquo;ve answered {answeredCount} of {questions.length}. Submitting is final \u2014 are you sure?
          </p>
          <button type="button" className="admin-submit" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Yes, submit'}
          </button>
          <button
            type="button"
            className="admin-nav-link"
            style={{ padding: '9px 16px' }}
            onClick={() => setConfirming(false)}
            disabled={submitting}
          >
            Keep working
          </button>
        </div>
      )}
    </div>
  );
}
