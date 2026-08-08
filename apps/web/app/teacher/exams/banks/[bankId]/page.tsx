import { apiFetch } from '../../../../../lib/api-client';
import { AddQuestionForm } from '../../../../../components/AddQuestionForm';
import { AiDraftQuestionForm } from '../../../../../components/AiDraftQuestionForm';
import { ReviewQuestionAction } from '../../../../../components/ReviewQuestionAction';

interface Bank {
  id: string;
  title: string;
  subject: string;
  gradeLevel: string;
}

interface QuestionItem {
  id: string;
  questionType: string;
  prompt: string;
  marks: string;
  aiGenerated: boolean;
  reviewStatus: 'approved' | 'pending' | 'rejected';
}

const STATUS_LABEL: Record<string, string> = {
  approved: 'Approved',
  pending: 'Pending review',
  rejected: 'Rejected'
};

export default async function QuestionBankDetailPage({ params }: { params: Promise<{ bankId: string }> }) {
  const { bankId } = await params;
  const [banks, questions] = await Promise.all([
    apiFetch<Bank[]>('/v1/question-banks'),
    apiFetch<QuestionItem[]>(`/v1/question-banks/${bankId}/questions`)
  ]);
  const bank = banks.find((b) => b.id === bankId);
  const approvedCount = questions.filter((q) => q.reviewStatus === 'approved').length;

  return (
    <div>
      <h1 className="admin-page-title">{bank ? bank.title : 'Question Bank'}</h1>
      {bank && (
        <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: -12, marginBottom: 'var(--eb-space-6)' }}>
          {bank.subject} \u2022 {bank.gradeLevel} \u2022 {approvedCount} approved question{approvedCount === 1 ? '' : 's'} ready
          for use in an exam
        </p>
      )}

      <div className="admin-section">
        <h2 className="admin-section-title">Questions</h2>
        {questions.length === 0 ? (
          <p className="admin-empty">No questions yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {questions.map((q) => (
              <div
                key={q.id}
                style={{
                  border: '1px solid var(--eb-line)',
                  borderRadius: 16,
                  padding: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span className="status-pill pending" style={{ textTransform: 'capitalize' }}>
                      {q.questionType.replace('_', ' ')}
                    </span>
                    <span className="status-pill pending">{q.marks} marks</span>
                    {q.aiGenerated && <span className="status-pill pending">AI-drafted</span>}
                    <span
                      className="status-pill pending"
                      style={{
                        background:
                          q.reviewStatus === 'approved' ? '#dcfce7' : q.reviewStatus === 'rejected' ? '#fee2e2' : undefined
                      }}
                    >
                      {STATUS_LABEL[q.reviewStatus]}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 14 }}>{q.prompt}</p>
                </div>
                {q.reviewStatus === 'pending' && <ReviewQuestionAction questionId={q.id} />}
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <AddQuestionForm bankId={bankId} />
          <AiDraftQuestionForm bankId={bankId} />
        </div>
      </div>
    </div>
  );
}
