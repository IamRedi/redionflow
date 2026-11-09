-- Field (assembly) list gets its own key: "field". Until now acting on a
-- site also meant ticking the field list. Copy every site choice to the field
-- list so nobody changes, except the factory engineers and the office, who
-- never ticked the field list before the access rules: they keep seeing it.
ALTER TABLE "AccessGrant" DROP CONSTRAINT "AccessGrant_place_check";
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_place_check" CHECK ("place" IN ('site','field','factory','new_project','fleet_gps','workshop','warehouse','daily_plan','costs','staff'));

INSERT INTO "AccessGrant" ("id","companyProfileId","place","scopeId","workerId","level","grantedByUserId","createdAt","updatedAt")
SELECT 'fld' || md5(g."id" || 'field'), g."companyProfileId", 'field', g."scopeId", g."workerId",
       CASE WHEN g."level" = 'act' AND w."crewRole" IN ('FACTORY_ENGINEER','OFFICE') THEN 'view' ELSE g."level" END,
       g."grantedByUserId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "AccessGrant" g
JOIN "Worker" w ON w."id" = g."workerId" AND w."companyProfileId" = g."companyProfileId"
WHERE g."place" = 'site'
ON CONFLICT ("companyProfileId","place","scopeId","workerId") DO NOTHING;
