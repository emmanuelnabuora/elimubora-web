-- ============================================================
-- 0011_finance_definer_policy.sql
--
-- Fixes a real bug found by integration testing: SECURITY DEFINER
-- changes which SQL PRIVILEGES apply (so a narrowly-scoped role can
-- read a table it wouldn't otherwise be granted), but it does NOT
-- bypass Row-Level Security. Under FORCE ROW LEVEL SECURITY, a role
-- with no matching permissive policy sees zero rows — including a
-- SECURITY DEFINER function running as that role. Migration 0010
-- granted elimubora_finance a table-level SELECT but never gave it
-- an RLS policy, so finance.lookup_pending_mpesa_payment silently
-- returned no rows for a real, committed payment.
--
-- Migration 0003 got this right for identity (core.users has
-- `users_auth_all ON core.users TO elimubora_auth USING (true)`);
-- this migration adds the equivalent for finance.
-- ============================================================

CREATE POLICY payments_finance_definer ON finance.payments
  TO elimubora_finance USING (true) WITH CHECK (true);
