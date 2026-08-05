import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/get-current-user';
import { OnboardTenantForm } from '../../../components/OnboardTenantForm';

export default async function OnboardTenantPage() {
  const result = await getCurrentUser();
  if (!result || result.user.role !== 'platform_admin') redirect('/admin');

  return (
    <div>
      <h1 className="admin-page-title">Onboard an organization</h1>
      <div className="admin-section">
        <OnboardTenantForm />
      </div>
    </div>
  );
}
