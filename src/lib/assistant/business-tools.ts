import { z } from 'zod';
import type { ToolSet } from 'ai';
import type { RequesterContext } from './requester';
import { assistantToolDate, isAssistantDateKey, type assistantTurnContext } from './turn-context';
import { adminSearchSteelProjects, adminSearchSteelElements, adminGetSteelElement, adminGetSteelProductionSummary, adminGetSteelProductionEvidence, adminGetSteelProjectBatches } from './steel-tools';
import { adminSearchCompanyWorkers, adminSearchCompanyFleet, adminGetCompanyFuelReceipts, adminSearchCompanyInventory } from './company-tools';

const text = z.string().trim().min(1).max(180);
const id = z.string().trim().min(1).max(120);
const date = z.string().refine(isAssistantDateKey, 'Use a valid YYYY-MM-DD calendar date.');
const month = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
const page = { cursor: id.optional(), limit: z.number().int().min(1).max(30).optional() };
const project = { projectId: id.optional(), projectName: text.optional() };
const companyText = z.string().trim().min(1).max(100);
const companyPage = { cursor: z.string().trim().min(1).max(80).optional(), limit: page.limit };
type Turn = ReturnType<typeof assistantTurnContext>;

function productionPeriod(turn: Turn, input: { date?: string; month?: string }) {
  const chosenDate = assistantToolDate(turn, input.date);
  return { date: chosenDate, month: chosenDate ? chosenDate.slice(0, 7) : input.month ?? (turn.currentMonthRequested ? turn.currentMonth : undefined) };
}

export function companyAssistantTools(requester: RequesterContext, steel = false): ToolSet {
  return {
    getAssistantCapabilities: {
      description: 'Static capabilities and limitations only, for greetings or questions about this assistant. Reads no workers, fleet, receipts or other business records. It provides no operational facts or statistics.',
      inputSchema: z.object({}),
      execute: async () => ({ ok: true, readOnly: true, canRead: ['authorized worker profiles, timesheets and availability', 'daily plan', 'vehicle metadata and last stored GPS', 'fuel receipt metadata', 'inventory catalog and recorded assignments', 'stored company knowledge', ...(steel ? ['steel projects, products, process progress and production confirmations'] : [])], limitations: ['No edits or confirmations', 'No live GPS/device query', 'No PDF/image/OCR or KiDraht content search', 'No unstored information or guaranteed prediction'], timeZone: requester.timeZone ?? 'Europe/Berlin' }),
    },
    adminSearchCompanyWorkers: {
      description: 'Discover workers by ID/name, operational profile/licenses/availability and exact matching count. Paginated candidates, not a guessed person. All statuses unless filtered.',
      inputSchema: z.object({ query: companyText.optional(), workerId: id.optional(), status: z.enum(['active', 'inactive', 'all']).optional(), ...companyPage }),
      execute: input => adminSearchCompanyWorkers(requester, input),
    },
    adminSearchCompanyFleet: {
      description: 'Search vehicles by ID/name/nickname/plate, show equipment details and last STORED GPS fix with reportedAt/age/stale status. Never refreshes GPS. Ambiguous names return candidate vehicles.',
      inputSchema: z.object({ query: companyText.optional(), machineId: id.optional(), active: z.boolean().optional(), ...companyPage }),
      execute: input => adminSearchCompanyFleet(requester, input),
    },
    adminGetCompanyFuelReceipts: {
      description: 'Read recorded fuel-receipt metadata, exact filtered counts and totals by currency. Distinguish dateBasis fueled versus uploaded (default uploaded). latest=true returns the latest matching selected event time; otherwise cursor-paged rows. Worker IDs filter upload versus fueling actor separately. Does not read receipt images or perform OCR.',
      inputSchema: z.object({ receiptId: id.optional(), machineId: id.optional(), uploadedByWorkerId: id.optional(), fueledByWorkerId: id.optional(), confirmed: z.boolean().optional(), from: date.optional(), to: date.optional(), dateBasis: z.enum(['uploaded', 'fueled']).optional(), latest: z.boolean().optional(), ...companyPage }),
      execute: input => adminGetCompanyFuelReceipts(requester, input),
    },
    adminSearchCompanyInventory: {
      description: 'Search the recorded company inventory catalog by item ID/name and count active worker assignments. Exact matching catalog count, paginated rows. Catalog/assignment counts do not establish physical stock balances or available quantities.',
      inputSchema: z.object({ query: companyText.optional(), itemId: id.optional(), ...companyPage }),
      execute: input => adminSearchCompanyInventory(requester, input),
    },
  };
}

export function steelAssistantTools(requester: RequesterContext, turn: Turn): ToolSet {
  return {
    adminSearchSteelProjects: {
      description: 'Discover actual AL Steel production projects/sites by name. Returns IDs, names/status/types, exact matching count and a cursor page. Do this before using a guessed project ID.',
      inputSchema: z.object({ query: text.optional(), ...page }),
      execute: input => adminSearchSteelProjects(requester, input),
    },
    adminSearchSteelElements: {
      description: 'Find steel products/drawing marks in Lista assemblaggi or Lista parti within the company/project. Paginated candidates include project/list identity; repeated marks require clarification.',
      inputSchema: z.object({ ...project, query: text.optional(), list: z.enum(['assembly', 'part']).optional(), ...page }),
      execute: input => adminSearchSteelElements(requester, input),
    },
    adminGetSteelElement: {
      description: 'Exact steel product by resolved elementId, or unique mark with optional project/list. Returns imported properties and current confirmed quantities for its applicable factory/site route. Ask on ambiguous marks.',
      inputSchema: z.object({ ...project, elementId: id.optional(), mark: text.optional(), list: z.enum(['assembly', 'part']).optional() }),
      execute: input => adminGetSteelElement(requester, input),
    },
    adminGetSteelProductionSummary: {
      description: 'Canonical AL Steel dashboard: current process progress, ready-for-site quantities and separate daily/month kg series for cutting parts, cutting assemblies and assembly. Exact totals, paginated project details. Historical month affects confirmation metrics; current progress is labeled separately. Never add the process kg series together.',
      inputSchema: z.object({ ...project, month: month.optional(), date: date.optional(), projectCursor: id.optional(), limit: page.limit }),
      execute: input => adminGetSteelProductionSummary(requester, { ...input, ...productionPeriod(turn, input) }),
    },
    adminGetSteelProductionEvidence: {
      description: 'Confirmed steel work by project/product/process/credited worker and date/month. Defaults today; month alone selects that month. Exact event/piece/known-kg totals plus cursor-page evidence; shared-team kg is NOT individual productivity and checker is NOT automatically the operator.',
      inputSchema: z.object({ ...project, elementId: id.optional(), workerId: id.optional(), workerName: text.optional(), stage: z.string().trim().min(1).max(32).optional(), date: date.optional(), month: month.optional(), ...page }),
      execute: input => adminGetSteelProductionEvidence(requester, { ...input, ...productionPeriod(turn, input) }),
    },
    adminGetSteelProjectBatches: {
      description: 'Read legacy order/production batches and their recorded steps by project or title/order reference. Batch units are separate from steel-element throughput; do not mix their quantities or kg.',
      inputSchema: z.object({ ...project, query: text.optional(), ...page }),
      execute: input => adminGetSteelProjectBatches(requester, input),
    },
  };
}
