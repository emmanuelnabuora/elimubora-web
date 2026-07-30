-- ============================================================
-- 0010_finance_gateway_lookup.sql
--
-- Fixes a real bug found before shipping: a payment gateway callback
-- (in production, Safaricom's Daraja callback) arrives with NO tenant
-- context — the caller is Safaricom, not an authenticated request.
-- finance.payments is FORCE RLS, so a plain SELECT with no bound
-- app.tenant_id sees zero rows regardless of whether a matching
-- pending payment exists (tenant_id = NULL is never true). This is
-- the exact same class of problem migration 0003 solved for
-- pre-authentication user lookups — a narrow SECURITY DEFINER
-- function, owned by a dedicated NOLOGIN role, that can look up
-- (only) a pending payment by its globally-unique gateway reference.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'elimubora_finance') THEN
    CREATE ROLE elimubora_finance NOLOGIN;
  END IF;
  EXECUTE format('GRANT elimubora_finance TO %I', current_user);
END $$;

GRANT USAGE, CREATE ON SCHEMA finance TO elimubora_finance;
GRANT SELECT ON finance.payments TO elimubora_finance;

CREATE OR REPLACE FUNCTION finance.lookup_pending_mpesa_payment(p_reference text)
RETURNS TABLE (id uuid, tenant_id uuid, invoice_id uuid, amount numeric)
LANGUAGE sql SECURITY DEFINER SET search_path = finance, pg_temp AS $$
  SELECT p.id, p.tenant_id, p.invoice_id, p.amount
    FROM finance.payments p
   WHERE p.reference = p_reference AND p.method = 'mpesa' AND p.status = 'pending'
$$;

ALTER FUNCTION finance.lookup_pending_mpesa_payment(text) OWNER TO elimubora_finance;
REVOKE ALL ON FUNCTION finance.lookup_pending_mpesa_payment(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finance.lookup_pending_mpesa_payment(text) TO elimubora_app;
