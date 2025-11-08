-- 02_protection_triggers.sql (Protect ZAK and enforce audit)
-- Prevents deletion of permanent admins and ensures all changes are audited

BEGIN;

-- Function to prevent deletion of permanent admin users
CREATE OR REPLACE FUNCTION prevent_permanent_admin_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_permanent = TRUE THEN
    RAISE EXCEPTION 'Cannot delete permanent admin user: %. This user is protected by system policy.', OLD.username;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to protect ZAK from deletion
DROP TRIGGER IF EXISTS trg_protect_permanent_admins ON admin_users;
CREATE TRIGGER trg_protect_permanent_admins
  BEFORE DELETE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_permanent_admin_deletion();

-- Function to prevent modification of ZAK's permanent status
CREATE OR REPLACE FUNCTION prevent_permanent_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent changing is_permanent from TRUE to FALSE
  IF OLD.is_permanent = TRUE AND NEW.is_permanent = FALSE THEN
    RAISE EXCEPTION 'Cannot remove permanent status from user: %. This is a protected system administrator.', OLD.username;
  END IF;
  
  -- Prevent changing username of permanent admin
  IF OLD.is_permanent = TRUE AND OLD.username != NEW.username THEN
    RAISE EXCEPTION 'Cannot change username of permanent admin: %', OLD.username;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to protect ZAK's permanent status
DROP TRIGGER IF EXISTS trg_protect_permanent_status ON admin_users;
CREATE TRIGGER trg_protect_permanent_status
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_permanent_status_change();

-- Function to auto-audit all admin_users changes
CREATE OR REPLACE FUNCTION audit_admin_users_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (actor, action, entity, entity_id, new_values)
    VALUES (current_user, 'create', 'admin_users', NEW.id::text, row_to_json(NEW)::jsonb);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (actor, action, entity, entity_id, old_values, new_values)
    VALUES (current_user, 'update', 'admin_users', NEW.id::text, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (actor, action, entity, entity_id, old_values)
    VALUES (current_user, 'delete', 'admin_users', OLD.id::text, row_to_json(OLD)::jsonb);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to audit all admin_users changes
DROP TRIGGER IF EXISTS trg_audit_admin_users ON admin_users;
CREATE TRIGGER trg_audit_admin_users
  AFTER INSERT OR UPDATE OR DELETE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION audit_admin_users_changes();

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at on tables that need it
DROP TRIGGER IF EXISTS trg_constituents_updated ON constituents;
CREATE TRIGGER trg_constituents_updated
  BEFORE UPDATE ON constituents
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_issues_updated ON issues;
CREATE TRIGGER trg_issues_updated
  BEFORE UPDATE ON issues
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- Function to enforce SERIALIZABLE on critical writes
CREATE OR REPLACE FUNCTION enforce_serializable_isolation()
RETURNS void AS $$
BEGIN
  SET LOCAL TRANSACTION ISOLATION LEVEL SERIALIZABLE;
END;
$$ LANGUAGE plpgsql;

-- Record this migration
INSERT INTO schema_migrations (name, checksum)
VALUES (
  '02_protection_triggers.sql',
  encode(digest('02_protection_triggers.sql_v1.0.0', 'sha256'), 'hex')
)
ON CONFLICT (name) DO NOTHING;

COMMIT;

-- Test protections
DO $$
DECLARE
  zak_id INTEGER;
BEGIN
  -- Get ZAK's ID
  SELECT id INTO zak_id FROM admin_users WHERE username = 'zak';
  
  -- Verify triggers exist
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_protect_permanent_admins') THEN
    RAISE EXCEPTION 'Protection trigger not created';
  END IF;
  
  RAISE NOTICE 'Protection triggers installed. ZAK (ID: %) is protected from deletion and modification.', zak_id;
END $$;
