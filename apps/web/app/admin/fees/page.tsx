import { apiFetch } from '../../../lib/api-client';
import { CreateFeeStructureForm } from './CreateFeeStructureForm';
import { CreateInvoiceForm } from './CreateInvoiceForm';

interface FeeStructure {
  id: string;
  gradeLevel: string;
  academicYear: number;
  term: number;
  amount: string;
  description: string | null;
}

interface Invoice {
  id: string;
  studentName: string;
  academicYear: number;
  term: number;
  amountDue: string;
  amountPaid: string;
  status: string;
}

interface StudentListItem {
  studentId: string;
  fullName: string;
}

export default async function FeesPage() {
  const [feeStructures, invoices, students] = await Promise.all([
    apiFetch<FeeStructure[]>('/v1/fee-structures'),
    apiFetch<Invoice[]>('/v1/invoices'),
    apiFetch<StudentListItem[]>('/v1/students')
  ]);

  return (
    <div>
      <h1 className="admin-page-title">Fees</h1>

      <div className="admin-section">
        <h2 className="admin-section-title">Create a fee structure</h2>
        <CreateFeeStructureForm />
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Fee structures ({feeStructures.length})</h2>
        {feeStructures.length === 0 ? (
          <p className="admin-empty">No fee structures yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Grade</th>
                <th>Year</th>
                <th>Term</th>
                <th>Amount</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {feeStructures.map((f) => (
                <tr key={f.id}>
                  <td>{f.gradeLevel}</td>
                  <td>{f.academicYear}</td>
                  <td>{f.term}</td>
                  <td>KES {f.amount}</td>
                  <td>{f.description ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Issue an invoice</h2>
        <CreateInvoiceForm students={students} feeStructures={feeStructures} />
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Invoices ({invoices.length})</h2>
        {invoices.length === 0 ? (
          <p className="admin-empty">No invoices yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Year / Term</th>
                <th>Due</th>
                <th>Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.studentName}</td>
                  <td>
                    {inv.academicYear} / T{inv.term}
                  </td>
                  <td>KES {inv.amountDue}</td>
                  <td>KES {inv.amountPaid}</td>
                  <td>
                    <span
                      className={`status-pill ${inv.status === 'paid' ? 'active' : inv.status === 'partial' ? 'pending' : 'inactive'}`}
                    >
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
