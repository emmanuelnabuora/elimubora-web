import { apiFetch } from '../../../lib/api-client';
import { HomeworkHelpForm } from './HomeworkHelpForm';

interface HistoryEntry {
  context: { subject?: string; gradeLevel?: string };
  promptSummary: string;
  responseSummary: string;
  createdAt: string;
}

export default async function HomeworkHelpPage() {
  const history = await apiFetch<HistoryEntry[]>('/v1/ai/homework-help/history');

  return (
    <div>
      <h1 className="admin-page-title">Homework Help</h1>
      <p style={{ color: 'var(--eb-fg-muted)', fontSize: 14, marginBottom: 'var(--eb-space-6)' }}>
        Ask a question about anything you&rsquo;re studying. This runs in a sandbox environment right now — real
        AI-generated answers are a planned upgrade, not yet connected.
      </p>

      <div className="admin-section">
        <h2 className="admin-section-title">Ask a question</h2>
        <HomeworkHelpForm />
      </div>

      {history.length > 0 && (
        <div className="admin-section">
          <h2 className="admin-section-title">Your recent questions</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Question</th>
                <th>Asked</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i}>
                  <td>{h.context.subject ?? '—'}</td>
                  <td>{h.promptSummary}</td>
                  <td>{new Date(h.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
