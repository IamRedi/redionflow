import { z } from 'zod';
import type { ToolSet } from 'ai';
import type { RequesterContext } from './requester';
import { assistantToolDate, isAssistantDateKey, type assistantTurnContext } from './turn-context';
import { adminSearchSteelProjects, adminSearchSteelElements, adminGetSteelElement, adminGetSteelProductionSummary, adminGetSteelProductionEvidence, adminGetSteelProjectBatches } from './steel-tools';
import { adminSearchCompanyWorkers, adminSearchCompanyFleet, adminGetCompanyFuelReceipts, adminSearchCompanyInventory } from './company-tools';
import { adminGetStartedSteelProjects } from './project-activity';
import { adminSearchCompanyAssets, adminGetCompanyWorkshop } from './asset-tools';
import { applyCanonicalAssetFilters, type CanonicalAssetIntent } from './asset-answer';
import { adminGetSitePhaseDocuments, adminGetSitePhaseDocumentReceipts, phaseDocumentListInput, phaseDocumentReceiptInput } from './document-tools';
import type { createDocumentResolution } from './document-resolution';
import { adminGetWorkforceStatus, workforceStatusInput } from './workforce-status';

// An empty search string means "no filter" (models sometimes send query: "").
const text = z.string().trim().max(180);
const id = z.string().trim().min(1).max(120);
const date = z.string().refine(isAssistantDateKey, 'Use a valid YYYY-MM-DD calendar date.');
const month = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
const page = { cursor: id.optional(), limit: z.number().int().min(1).max(30).optional() };
const project = { projectId: id.optional(), projectName: text.optional() };
const companyText = z.string().trim().max(100);
const companyPage = { cursor: z.string().trim().min(1).max(80).optional(), limit: page.limit };
const assetPage = { cursor: z.string().regex(/^(machine|inventory):[a-z0-9_-]{1,120}$/i).optional(), limit: z.number().int().min(1).max(20).optional() };
const assetFilters = {
  query: z.string().trim().max(100).optional(), assetKind: z.enum(['machine', 'inventory']).optional(), assetId: id.optional(),
  category: z.enum(['vehicle', 'tool', 'clothing', 'equipment']).optional(), holderWorkerId: id.optional(),
  repairPhase: z.enum(['active', 'reported', 'received', 'repairing']).optional(), repairLocation: z.enum(['internal', 'external']).optional(), ...assetPage,
};
type Turn = ReturnType<typeof assistantTurnContext>;

function productionPeriod(turn: Turn, input: { date?: string; month?: string }) {
  const chosenDate = assistantToolDate(turn, input.date);
  return { date: chosenDate, month: chosenDate ? chosenDate.slice(0, 7) : input.month ?? (turn.currentMonthRequested ? turn.currentMonth : undefined) };
}

export function companyAssistantTools(requester: RequesterContext, steel = false, assetIntent: CanonicalAssetIntent | null = null): ToolSet {
  return {
    getAssistantCapabilities: {
      description: 'Static capabilities and limitations only, for greetings or questions about this assistant. Reads no workers, fleet, receipts or other business records. It provides no operational facts or statistics.',
      inputSchema: z.object({}),
      execute: async () => ({ ok: true, readOnly: true, canRead: ['authorized worker profiles, timesheets and availability', 'daily plan', 'vehicle metadata and last stored GPS', 'fuel receipt metadata', 'inventory catalog and recorded assignments', 'stored company knowledge', ...(steel ? ['steel projects, products, process progress and production confirmations', 'warehouse assets, recorded custody and assigned sites, pending handovers and current workshop phases/routes', 'site phase-document metadata, version-specific personal receipts and currently authorized accounts without confirmation'] : [])], limitations: ['No edits or confirmations', 'No live GPS/device query or verified physical warehouse/bin location', 'No PDF/image/OCR or KiDraht content search', 'No unstored information or guaranteed prediction'], timeZone: requester.timeZone ?? 'Europe/Berlin' }),
    },
    adminSearchCompanyWorkers: {
      description: 'Discover workers by ID/name, operational profile/licenses/availability and exact matching count. Paginated candidates, not a guessed person. All statuses unless filtered.',
      inputSchema: z.object({ query: companyText.optional(), workerId: id.optional(), status: z.enum(['active', 'inactive', 'all']).optional(), ...companyPage }),
      execute: input => adminSearchCompanyWorkers(requester, input),
    },
    ...(steel ? {adminGetWorkforceStatus: {
      description: 'Current office/site/factory clocks, pauses and ends today. Exact counts, paginated names, unknown/conflicts. End records do not identify who clicked stop; system closures are distinct. Not physical/GPS proof or history.',
      inputSchema: workforceStatusInput,
      execute: input => adminGetWorkforceStatus(requester, input),
    }} : {}),
    adminSearchCompanyFleet: {
      description: 'Search vehicles by ID/name/nickname/plate, equipment and last STORED GPS. In steel companies active/baseRecordActive is only the register flag, never usability: current operationalAvailability/usable includes confirmed custody, pending handovers, reports and workshop blocks. Null or incomplete operational coverage is unknown; never fall back to active=true. Current asset status is separate from historical plan dates. Never refreshes GPS; ambiguous names remain candidates.',
      inputSchema: z.object({ query: companyText.optional(), machineId: id.optional(), active: z.boolean().optional(), ...companyPage }),
      execute: input => adminSearchCompanyFleet(requester, input),
    },
    adminGetCompanyFuelReceipts: {
      description: 'Read recorded fuel-receipt metadata, exact filtered counts and totals by currency. Distinguish dateBasis fueled versus uploaded (default uploaded). latest=true returns the latest matching selected event time; otherwise cursor-paged rows. Worker IDs filter upload versus fueling actor separately. Does not read receipt images or perform OCR.',
      inputSchema: z.object({ receiptId: id.optional(), machineId: id.optional(), uploadedByWorkerId: id.optional(), fueledByWorkerId: id.optional(), confirmed: z.boolean().optional(), from: date.optional(), to: date.optional(), dateBasis: z.enum(['uploaded', 'fueled']).optional(), latest: z.boolean().optional(), ...companyPage }),
      execute: input => adminGetCompanyFuelReceipts(requester, input),
    },
    adminSearchCompanyInventory: {
      description: 'Search inventory catalog and count recorded active worker assignments. In steel companies include current operationalAvailability/usable; base active or ACTIVE assignment rows do not prove current condition/possession or free warehouse stock. Lost/retired responsibility records may remain ACTIVE in historical worker rows. Null/incomplete operational coverage is unknown. Exact matching catalog count and paginated rows, never invented stock quantities.',
      inputSchema: z.object({ query: companyText.optional(), itemId: id.optional(), ...companyPage }),
      execute: input => adminSearchCompanyInventory(requester, input),
    },
    ...(steel && requester.kind === 'admin' ? {
      adminSearchCompanyAssets: {
        description: 'Read company warehouse/fleet asset records by name/code/plate or exact assetKind+assetId. Returns recorded current holder, assigned site, pending versus completed handovers, availability and current repair. holderWorkerId filters only current responsibility, never pending recipient or repair origin; discover worker ID first. Exact filtered total and bounded cursor page. Multiple name matches require clarification. Unassigned does not prove physical warehouse presence; no GPS or file contents.',
        inputSchema: z.object(assetFilters),
        execute: (input: Parameters<typeof adminSearchCompanyAssets>[1]) => adminSearchCompanyAssets(requester, applyCanonicalAssetFilters(assetIntent, 'adminSearchCompanyAssets', input ?? {})),
      },
      adminGetCompanyWorkshop: {
        description: 'Which vehicles/tools are in the workshop? Same canonical asset read, filtered before totals/pagination to CURRENT active repair jobs. Default repairPhase=active includes reported, received and repairing; these are distinct phases. Use repairing for actively being repaired, received for accepted, reported for awaiting reception. Filter assetKind=machine for vehicles, repairLocation=external for outside service. A reported defect is not physical reception. Repair route/provider is recorded workflow, not GPS/address. No invoices or file contents.',
        inputSchema: z.object(assetFilters),
        execute: (input: Parameters<typeof adminGetCompanyWorkshop>[1]) => adminGetCompanyWorkshop(requester, applyCanonicalAssetFilters(assetIntent, 'adminGetCompanyWorkshop', input ?? {})),
      },
    } : {}),
  };
}

export function steelAssistantTools(requester: RequesterContext, turn: Turn, documents: ReturnType<typeof createDocumentResolution>): ToolSet {
  return {
    adminGetSitePhaseDocuments: {
      description: 'Which documents does a steel site have? Use exact projectName or discovered projectId; duplicate names require selection. Lists six-phase document metadata, exact filtered counts and version-specific receipt counts. Defaults current unarchived versions; includeArchived only for requested history. Optional title/filename query and phase filter; bounded cursor pages. Does not read file contents or general site files.',
      inputSchema: phaseDocumentListInput,
      execute: input => adminGetSitePhaseDocuments(requester, input),
    },
    adminGetSitePhaseDocumentReceipts: {
      description: 'Who confirmed E mora for an exact document version, and who has not? Resolve documentId with the phase-document list first. status=received lists immutable named/time-stamped receipts, including people whose access changed. status=unconfirmed lists active currently authorized office/engineer/admin accounts without that receipt, NOT assigned recipients or proof of unread files. status=all includes both. Exact counts and bounded cursor pages. Account identities can share a human/name; never merge by name or carry receipts across versions.',
      inputSchema: phaseDocumentReceiptInput,
      execute: input => !documents.has(input.documentId)
        ? Promise.resolve({ ok: false, code: 'DOCUMENT_NOT_RESOLVED', message: 'Use an exact document ID returned by the phase-document list in this turn. Never substitute a project ID or guess; resolve the document first.' })
        : adminGetSitePhaseDocumentReceipts(requester, input),
    },
    adminGetStartedSteelProjects: {
      description: 'Which/how many steel sites have started work? Returns exact count and compact project names with first/last stored activity. Defaults active STEEL_ASSEMBLY sites, any recorded factory/site activity; import/status alone never counts. scope=factory uses factory confirmations/start-done legacy events; scope=site uses field confirmations/project clock-ins. Not proof of current ongoing physical work.',
      inputSchema: z.object({ scope: z.enum(['any', 'factory', 'site']).optional(), includeInactive: z.boolean().optional(), ...page }),
      execute: input => adminGetStartedSteelProjects(requester, input),
    },
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
