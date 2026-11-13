import { cookies } from "next/headers";
import { readSessionCookie } from "@/lib/auth/session-cookie";
import { currentDemoActor } from "../demo-actor";
import { requireWorkshopDemo, SharedWorkshopError, workshopDirectory } from "../shared-store";
import { officeRole, type OfficeRole } from "./model";

export const OFFICE_COOKIE = "bdf_demo_office";
/** Explicit fictional persona selector. Never an operational account or access grant. */
export async function demoOfficeActor(): Promise<{ role: OfficeRole; companyId: string }> {
  const company = await requireWorkshopDemo(), actor = await currentDemoActor(await workshopDirectory());
  if (actor.role !== "admin") throw new SharedWorkshopError("permission", 403);
  const cookie = (await cookies()).get(OFFICE_COOKIE)?.value, raw = readSessionCookie(cookie, "display");
  if (!raw) { if (cookie) throw new SharedWorkshopError("permission", 403); return { role: "manager", companyId: company.id }; }
  if (!raw.id.startsWith("bdf-office:")) throw new SharedWorkshopError("permission", 403);
  const role = officeRole.safeParse(raw.id.slice(11));
  if (!role.success) throw new SharedWorkshopError("permission", 403);
  return { role: role.data, companyId: company.id };
}
