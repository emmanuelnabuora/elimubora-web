// One-time bootstrap: creates the single "ElimuBora Platform" tenant
// (kind='platform') and its first platform_admin user. This is the
// only way the very first platform_admin can ever come into being --
// POST /v1/tenants (the real onboarding endpoint for new SCHOOLS) is
// itself platform_admin-gated, so nothing can call it until at least
// one platform_admin already exists. Every authorization system has
// exactly this bootstrapping problem for its very first privileged
// account; a manual, direct-DB-access script run once is the standard,
// honest way to solve it -- there is no API-only path to this by
// construction, and there shouldn't be.
//
// Connects as elimubora_app, NOT the migrations/owner role -- found
// the hard way by actually running this against a real database
// before writing it off as "should work". Two separate FORCE ROW
// LEVEL SECURITY tables required getting the ordering right, not
// just the role:
//   1. core.memberships: its policy is scoped `TO elimubora_app`
//      specifically, so even the table owner is denied by Postgres's
//      default-deny behavior when RLS is forced and no policy
//      applies to the connecting role.
//   2. core.users (added under FORCE RLS in a LATER migration than
//      the table's own creation, missed on a first read of just the
//      schema-defining migration): its SELECT policies require either
//      "this is your own row" or "a membership links this user to the
//      CURRENT tenant context" -- with no tenant context set yet, an
//      already-existing platform_admin is invisible to a plain
//      SELECT, not merely absent. Found by running this script a
//      SECOND time to check idempotency and watching it try to
//      recreate a user that demonstrably already existed.
// app.tenant_id is set via set_config as soon as the tenant is
// resolved (created or found), before ANY subsequent read or write
// that touches core.users or core.memberships -- exactly mirroring
// what DatabaseService.withContext() does for the real application.
// Everything runs in one explicit transaction -- the first version of
// this script didn't, and a real run left an orphaned tenant + user
// behind (no membership) when the memberships insert failed.
//
// Idempotent: safe to run more than once. Reuses the platform tenant
// if it already exists; skips creating the admin user if that email
// is already registered.
//
// Usage:
//   DATABASE_URL=postgres://elimubora_app:PASSWORD@HOST:5432/elimubora \
//   PLATFORM_ADMIN_EMAIL=you@elimubora.co \
//   PLATFORM_ADMIN_NAME="Your Name" \
//   PLATFORM_ADMIN_PASSWORD='a genuinely long, real password' \
//   node tools/bootstrap-platform-admin.mjs
import pg from 'pg';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';

const appUrl = process.env.DATABASE_URL;
const email = process.env.PLATFORM_ADMIN_EMAIL;
const fullName = process.env.PLATFORM_ADMIN_NAME;
const password = process.env.PLATFORM_ADMIN_PASSWORD;

if (!appUrl || !email || !fullName || !password) {
  console.error('Set DATABASE_URL (the elimubora_app role), PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_NAME, and PLATFORM_ADMIN_PASSWORD.');
  process.exit(1);
}
if (password.length < 12) {
  console.error('PLATFORM_ADMIN_PASSWORD must be at least 12 characters -- this account has platform-wide reach.');
  process.exit(1);
}

// Matches PasswordService's exact Argon2id parameters -- a hash
// produced any other way would not verify against the real /auth/login
// path, since this script writes directly to Postgres rather than
// going through the application.
const passwordHash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1
});

const client = new pg.Client({ connectionString: appUrl });
await client.connect();

try {
  await client.query('BEGIN');

  let tenantId;
  const existingTenant = await client.query(`SELECT id FROM core.tenants WHERE slug = 'elimubora-platform'`);
  if (existingTenant.rows[0]) {
    tenantId = existingTenant.rows[0].id;
    console.log(`Platform tenant already exists: ${tenantId}`);
  } else {
    const created = await client.query(
      `INSERT INTO core.tenants (slug, name, kind) VALUES ('elimubora-platform', 'ElimuBora Platform', 'platform') RETURNING id`
    );
    tenantId = created.rows[0].id;
    console.log(`Created platform tenant: ${tenantId}`);
  }

  // core.users ALSO has FORCE ROW LEVEL SECURITY (added in migration
  // 0003, after the table's original creation — missed on first read
  // of the schema, found only by actually running this script twice).
  // Its SELECT policies require either "this is your own row" or "a
  // membership links this user to the CURRENT tenant context" — with
  // no tenant context set, an already-existing platform_admin is
  // invisible to a plain SELECT, not merely absent. Setting this here,
  // before the existence check, rather than only later before the
  // memberships insert, is the actual fix — moving it earlier is the
  // whole point, not a stylistic choice.
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);

  const existingUser = await client.query(`SELECT id FROM core.users WHERE email = $1`, [email.toLowerCase()]);
  if (existingUser.rows[0]) {
    console.log(`A user with this email already exists (id: ${existingUser.rows[0].id}) -- not creating another.`);
    console.log('If they need the platform_admin role added, do that directly rather than re-running this script.');
  } else {
    const userId = randomUUID();
    await client.query(`INSERT INTO core.users (id, email, full_name, password_hash) VALUES ($1, $2, $3, $4)`, [
      userId,
      email.toLowerCase(),
      fullName,
      passwordHash
    ]);
    await client.query(
      `INSERT INTO core.memberships (user_id, tenant_id, role, status) VALUES ($1, core.current_tenant_id(), 'platform_admin', 'active')`,
      [userId]
    );
    console.log(`Created platform_admin user: ${userId} (${email})`);
  }

  await client.query('COMMIT');
  console.log('Done. This account can now log in via the normal /v1/auth/login and call POST /v1/tenants.');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  await client.end();
}
