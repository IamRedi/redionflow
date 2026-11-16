import { cache } from 'react';
import { currentDemoActor } from '@/lib/workshop/demo-actor';
import { requireWorkshopDemo, SharedWorkshopError, workshopDirectory } from '@/lib/workshop/shared-store';
import { demoOfficeActor } from '@/lib/workshop/offices/access';
import { officePeople } from '@/lib/workshop/offices/copy';
import type { ChatIdentity } from './contract';

/** Only the explicitly isolated, fictional Baumdienst installation. */
export const companyChatIdentity = cache(async (demo = false, office = false): Promise<ChatIdentity | null> => {
  if (!demo) return null;
  try {
    const company = await requireWorkshopDemo();
    if (office) {
      // This adapter is served below the existing office-cookie path. Neither
      // that private cookie nor office permissions are widened for chat.
      const actor = await demoOfficeActor();
      return { companyId: company.id, key: `demo-office:${actor.role}`, name: officePeople[actor.role], demo: true, context: 'office' };
    }
    const directory = await workshopDirectory(), actor = await currentDemoActor(directory);
    if (actor.role === 'admin') return { companyId: company.id, key: 'demo-office:manager', name: officePeople.manager, demo: true };
    const worker = directory.workers.find(w => w.key === actor.key);
    return worker ? { companyId: company.id, key: `worker:${worker.id}`, name: worker.name.slice(0,160), notificationUserId: worker.id, demo: true } : null;
  } catch (error) { if (error instanceof SharedWorkshopError) return null; throw error; }
});
