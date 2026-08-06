'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { parseCsv } from '../lib/csv';

interface ImportResult {
  created: number;
  failed: Array<{ row: number; message: string }>;
}

export function CsvImportForm({
  endpoint,
  columns,
  sampleRow
}: {
  /** BFF route that accepts { rows: Record<string,string>[] } and returns ImportResult. */
  endpoint: string;
  /** Column names shown to the admin as what the CSV should contain. */
  columns: string[];
  /** One example data row, same length/order as columns, for the downloadable template. */
  sampleRow: string[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function downloadTemplate() {
    const csv = [columns.join(','), sampleRow.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setError('That file has no data rows — check it has a header row plus at least one row beneath it.');
        return;
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rows })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not process that file. Try again.');
        return;
      }
      setResult(data as ImportResult);
      router.refresh();
    } catch {
      setError('Could not read or upload that file. Check your connection and try again.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--eb-fg-muted)', marginTop: 0, marginBottom: 10 }}>
        CSV columns expected: <code>{columns.join(', ')}</code>.{' '}
        <button
          type="button"
          onClick={downloadTemplate}
          style={{ background: 'none', border: 'none', color: 'var(--eb-primary)', cursor: 'pointer', padding: 0, font: 'inherit' }}
        >
          Download a template
        </button>
      </p>
      <label className="admin-nav-link" style={{ display: 'inline-block', padding: '9px 16px', cursor: 'pointer' }}>
        {loading ? 'Uploading…' : fileName ? `Choose a different file (${fileName})` : 'Choose a CSV file'}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          disabled={loading}
          style={{ display: 'none' }}
        />
      </label>
      {error && <p className="auth-error">{error}</p>}
      {result && (
        <div style={{ marginTop: 10 }}>
          <p className="dashboard-subhead" style={{ color: 'var(--eb-primary)', margin: '0 0 6px' }}>
            {result.created} of {result.created + result.failed.length} row(s) created.
          </p>
          {result.failed.length > 0 && (
            <ul style={{ fontSize: 13, color: '#b45309', margin: 0, paddingLeft: 18 }}>
              {result.failed.map((f, i) => (
                <li key={i}>
                  Row {f.row}: {f.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
