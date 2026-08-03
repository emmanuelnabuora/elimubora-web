// Seeds a demo school tenant plus one working login per role, for
// local development only. Never run this against a production
// database — these are publicly documented, intentionally simple
// credentials, exactly the opposite of what a real account should have.
//
// Usage:
//   MIGRATIONS_DATABASE_URL=postgres://elimubora:elimubora_dev_password@localhost:5432/elimubora \
//   API_URL=http://localhost:4000 \
//   node tools/seed-dev-data.mjs
//
// Idempotent: safe to run more than once. If the demo tenants already
// exist, reuses them; if a demo user already exists, skips creating
// it again and just reports the credentials.
import pg from 'pg';

const ownerUrl = process.env.MIGRATIONS_DATABASE_URL;
const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
const password = 'Demo-Password-2026';

if (!ownerUrl) {
  console.error('Set MIGRATIONS_DATABASE_URL to your Postgres owner connection string.');
  process.exit(1);
}

async function findOrCreateTenant(client, slug, name, kind, countyCode) {
  const existing = await client.query('SELECT id FROM core.tenants WHERE slug = $1', [slug]);
  if (existing.rows[0]) return existing.rows[0].id;
  const created = await client.query(
    'INSERT INTO core.tenants (slug, name, kind, county_code) VALUES ($1, $2, $3, $4) RETURNING id',
    [slug, name, kind, countyCode ?? null]
  );
  return created.rows[0].id;
}

const client = new pg.Client({ connectionString: ownerUrl });
await client.connect();

let schoolTenantId, ministryTenantId;
try {
  schoolTenantId = await findOrCreateTenant(client, 'demo-school', 'ElimuBora Demo School', 'school', '047');
  ministryTenantId = await findOrCreateTenant(client, 'demo-ministry', 'Demo Ministry HQ', 'ministry');
  console.log(`Demo school tenant:   ${schoolTenantId}`);
  console.log(`Demo ministry tenant: ${ministryTenantId}`);
} finally {
  await client.end();
}

const demoUsers = [
  { email: 'teacher@demo.elimubora.ke', fullName: 'Demo Teacher', role: 'teacher', tenantId: schoolTenantId },
  { email: 'student@demo.elimubora.ke', fullName: 'Demo Student', role: 'learner', tenantId: schoolTenantId },
  { email: 'parent@demo.elimubora.ke', fullName: 'Demo Parent', role: 'parent', tenantId: schoolTenantId },
  { email: 'admin@demo.elimubora.ke', fullName: 'Demo Administrator', role: 'school_admin', tenantId: schoolTenantId },
  {
    email: 'ministry@demo.elimubora.ke',
    fullName: 'Demo Ministry Official',
    role: 'ministry_official',
    tenantId: ministryTenantId
  }
];

console.log(`\nRegistering ${demoUsers.length} demo accounts via ${apiUrl}/v1/auth/register ...\n`);

for (const user of demoUsers) {
  const res = await fetch(`${apiUrl}/v1/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: user.email,
      fullName: user.fullName,
      password,
      tenantId: user.tenantId,
      role: user.role
    })
  });

  if (res.status === 201) {
    console.log(`  \u2713 created  ${user.role.padEnd(18)} ${user.email}`);
  } else if (res.status === 409 || res.status === 400) {
    console.log(`  \u00b7 exists   ${user.role.padEnd(18)} ${user.email}`);
  } else {
    const body = await res.text();
    console.log(`  \u2717 failed   ${user.role.padEnd(18)} ${user.email} \u2014 HTTP ${res.status}: ${body}`);
  }
}

console.log(`\nAll demo accounts use the password: ${password}\n`);
