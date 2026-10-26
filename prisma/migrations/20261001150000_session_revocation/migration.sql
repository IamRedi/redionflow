BEGIN;
-- Credential revocation is atomic with the row write, including future callers.
CREATE FUNCTION public.bk_revoke_changed_credentials() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE changed boolean;
BEGIN
  IF TG_TABLE_NAME = 'User' THEN
    changed := NEW."passwordHash" IS DISTINCT FROM OLD."passwordHash"
      OR NEW.role IS DISTINCT FROM OLD.role OR NEW."isActive" IS DISTINCT FROM OLD."isActive";
  ELSE
    changed := NEW."loginCodeHash" IS DISTINCT FROM OLD."loginCodeHash"
      OR NEW."loginCode" IS DISTINCT FROM OLD."loginCode" OR NEW.status IS DISTINCT FROM OLD.status;
  END IF;
  NEW."sessionEpoch" := GREATEST(NEW."sessionEpoch", OLD."sessionEpoch" + CASE WHEN changed THEN 1 ELSE 0 END);
  RETURN NEW;
END $$;
CREATE TRIGGER bk_user_credential_epoch BEFORE UPDATE ON public."User"
FOR EACH ROW EXECUTE FUNCTION public.bk_revoke_changed_credentials();
CREATE TRIGGER bk_worker_credential_epoch BEFORE UPDATE ON public."Worker"
FOR EACH ROW EXECUTE FUNCTION public.bk_revoke_changed_credentials();

CREATE FUNCTION public.bk_audit_session_revocation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW."sessionEpoch" > OLD."sessionEpoch" AND NEW."companyProfileId" IS NOT NULL THEN
    INSERT INTO public."AuditLog" (id, "companyProfileId", "actorType", action, payload, "createdAt")
    VALUES ('epoch-' || md5(random()::text || clock_timestamp()::text), NEW."companyProfileId", 'SYSTEM',
      'session.revoked', jsonb_build_object('subjectId', NEW.id, 'accountKind', TG_TABLE_NAME), now());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bk_user_epoch_audit AFTER UPDATE ON public."User"
FOR EACH ROW EXECUTE FUNCTION public.bk_audit_session_revocation();
CREATE TRIGGER bk_worker_epoch_audit AFTER UPDATE ON public."Worker"
FOR EACH ROW EXECUTE FUNCTION public.bk_audit_session_revocation();

COMMIT;
