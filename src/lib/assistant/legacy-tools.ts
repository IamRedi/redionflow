import { z } from 'zod';
import type { ToolSet } from 'ai';
import { ASSISTANT_LANGUAGE_CODES, type AssistantLanguageCode } from './language';
import type { RequesterContext } from './requester';
import { assistantToolDate, type assistantTurnContext } from './turn-context';
import {
  adminGetDashboardSnapshot,
  adminGetHoursAggregate,
  adminGetHoursRanking,
  adminGetLiveWorkforce,
  adminListBaustellenOverview,
  adminListOpenManualTasks,
  adminListProjects,
  adminSearchWorkersByLicense,
} from "@/lib/assistant/admin-tools";
import {
  adminGetOwnDailyReport,
  adminGetWorkerDailyReport,
  adminGetWorkerMonthlyTimesheet,
  getAssignedMachine,
  getCompanyBaustellenDirectory,
  getEquipmentStatus,
  getKnowledge,
  getLiveLocation,
  getMyDailyReport,
  getMyHoursSummary,
  getMyMonthlyTimesheet,
  getMyOperationalSnapshot,
  getMyVacationSummary,
  getWorkerHrProfile,
  getWorkerPrivateSummary,
  adminGetAvailabilityForDate,
  adminAnalyzeDailyPlanLicenses,
  adminGetTeamDailyReport,
  adminQueryDailyPlan,
  adminListVacationRequests,
} from "@/lib/assistant/tools";

/** Existing operational tools; steel production has its own canonical data tools. */
export function legacyAssistantTools(requester: RequesterContext, turn: ReturnType<typeof assistantTurnContext>, steel: boolean): ToolSet {
  const currentMonth = turn.currentMonth;
  const turnDate = turn.singleDate;
  const tools = {
      getMyOperationalSnapshot: {
        description:
          'Logged-in worker: current live location and today\'s machine/plan assignment. No parameters. Always use this for "ku je?", "wo arbeite ich?", or "where am I?".',
        inputSchema: z.object({}),
        execute: async () => getMyOperationalSnapshot(requester),
      },
      getMyHoursSummary: {
        description: "Worker only: own worked hours over the last days, optional days (1-31, default 14).",
        inputSchema: z.object({ days: z.number().optional() }),
        execute: async (input: { days?: number }) => getMyHoursSummary(requester, input),
      },
      getMyDailyReport: {
        description:
          "Worker only: own daily report as shown in the UI, including live timesheet sessions, local start/end times, hours so far, sites, colleagues, material actions, completed trees, manual tasks, and notes. Optional date as YYYY-MM-DD. Always use startTime/endTime for visible times.",
        inputSchema: z.object({ date: z.string().optional() }),
        execute: async (input: { date?: string }) => getMyDailyReport(requester, { date: assistantToolDate(turn, input.date) ?? turn.today }),
      },
      getMyMonthlyTimesheet: {
        description:
          "Worker only: own monthly timesheet as shown in the UI, including day rows, local start/end times, breaks, sites, live hours so far, admin time rows, and notes. Optional month as YYYY-MM.",
        inputSchema: z.object({ month: z.string().optional() }),
        execute: async (input: { month?: string }) => getMyMonthlyTimesheet(requester, { month: input.month ?? (turn.currentMonthRequested ? currentMonth : undefined) }),
      },
      getMyVacationSummary: {
        description:
          "Worker only: own vacation data as shown in the profile. Includes vacation balance, approved days, pending days, remaining days, and own vacation history. Summarize briefly and without links.",
        inputSchema: z.object({}),
        execute: async () => getMyVacationSummary(requester),
      },
      getLiveLocation: {
        description: "Where is a worker currently live on a site? No hours or private reports.",
        inputSchema: z.object({ workerName: z.string() }),
        execute: async (input: { workerName: string }) => getLiveLocation(requester, input),
      },
      getAssignedMachine: {
        description: "Which machine is assigned to a worker in the daily plan?",
        inputSchema: z.object({ workerName: z.string(), date: z.string().optional() }),
        execute: async (input: { workerName: string; date?: string }) => getAssignedMachine(requester, { ...input, date: assistantToolDate(turn, input.date) ?? turn.today }),
      },
      getEquipmentStatus: {
        description: "Where is safety material (SIGN/PLATE/FENCE) currently on site?",
        inputSchema: z.object({ category: z.enum(["SIGN", "PLATE", "FENCE"]), limit: z.number().optional() }),
        execute: async (input: { category: "SIGN" | "PLATE" | "FENCE"; limit?: number }) => getEquipmentStatus(requester, input),
      },
      getKnowledge: {
        description: "Retrieve company/app knowledge (CompanyKnowledge).",
        inputSchema: z.object({ query: z.string(), language: z.enum(ASSISTANT_LANGUAGE_CODES).optional() }),
        execute: async (input: { query: string; language?: AssistantLanguageCode }) => getKnowledge(requester, input),
      },
      getWorkerPrivateSummary: {
        description: "Admin only: sensitive worker summary with hours/sessions.",
        inputSchema: z.object({ workerName: z.string(), days: z.number().optional() }),
        execute: async (input: { workerName: string; days?: number }) => getWorkerPrivateSummary(requester, input),
      },
      getWorkerHrProfile: {
        description:
          "Admin only: HR/profile data for a worker, licenses, position, level, contact details, work equipment, and clothing.",
        inputSchema: z.object({ workerName: z.string() }),
        execute: async (input: { workerName: string }) => getWorkerHrProfile(requester, input),
      },
      adminGetWorkerDailyReport: {
        description:
          "Admin only: worker daily report as shown in the UI. Includes live timesheet sessions, local start/end times, hours so far, sites, colleagues, material actions, completed trees, manual tasks, and notes. workerName required, date optional YYYY-MM-DD. Always use startTime/endTime for visible times.",
        inputSchema: z.object({ workerName: z.string(), date: z.string().optional() }),
        execute: async (input: { workerName: string; date?: string }) =>
          adminGetWorkerDailyReport(requester, { ...input, date: assistantToolDate(turn, input.date) ?? turn.today }),
      },
      adminGetTeamDailyReport: {
        description:
          "Admin only: team daily report for a date. Use for questions such as who completed trees today, how many trees per worker, who worked today, or who had material actions. Returns all active daily data from one source.",
        inputSchema: z.object({ date: z.string().optional() }),
        execute: async (input: { date?: string }) => adminGetTeamDailyReport(requester, { date: assistantToolDate(turn, input.date) ?? turn.today }),
      },
      adminGetWorkerMonthlyTimesheet: {
        description:
          "Admin only: worker monthly timesheet as shown in the UI. Includes day rows, local start/end times, live total hours so far, admin time rows, and notes. workerName required, month optional YYYY-MM.",
        inputSchema: z.object({ workerName: z.string(), month: z.string().optional() }),
        execute: async (input: { workerName: string; month?: string }) =>
          adminGetWorkerMonthlyTimesheet(requester, { ...input, month: input.month ?? (turn.currentMonthRequested ? currentMonth : undefined) }),
      },
      adminGetOwnDailyReport: {
        description: "Admin only: own admin daily report as shown in the UI, including own tasks and completed trees. date optional YYYY-MM-DD.",
        inputSchema: z.object({ date: z.string().optional() }),
        execute: async (input: { date?: string }) => adminGetOwnDailyReport(requester, { date: assistantToolDate(turn, input.date) ?? turn.today }),
      },
      getCompanyBaustellenDirectory: {
        description: "Active company sites: name, type, address, and short description. Available to workers and admins.",
        inputSchema: z.object({}),
        execute: async () => getCompanyBaustellenDirectory(requester),
      },
      ...(!steel ? {adminGetLiveWorkforce: {
        description: "Admin only: all workers currently clocked in live, site, and since when.",
        inputSchema: z.object({}),
        execute: async () => adminGetLiveWorkforce(requester),
      }} : {}),
      adminGetDashboardSnapshot: {
        description:
          "Admin only: read-only snapshot of the real admin dashboard with KPI statistics, site progress, weekly hours per site, and worker rankings. Prefer this for dashboard/KPI questions and never invent numbers.",
        inputSchema: z.object({
          includeWeeklyBaustellen: z.boolean().optional(),
          includeProgress: z.boolean().optional(),
          includeWorkerRanking: z.boolean().optional(),
        }),
        execute: async (input: {
          includeWeeklyBaustellen?: boolean;
          includeProgress?: boolean;
          includeWorkerRanking?: boolean;
        }) => adminGetDashboardSnapshot(requester, input),
      },
      adminGetAvailabilityForDate: {
        description:
          "Admin only: checks which active workers are available/ready for a date. Considers approved vacation and profile status (sick, vacation, unavailable). Shows pending vacation requests for that date separately. Do not output links in answers.",
        inputSchema: z.object({ date: z.string().optional() }),
        execute: async (input: { date?: string }) => adminGetAvailabilityForDate(requester, { date: assistantToolDate(turn, input.date) ?? turn.today }),
      },
      adminAnalyzeDailyPlanLicenses: {
        description:
          "Admin only: daily plan licenses/requirements. In steel companies consult current operationalAvailability/usable and coverage warnings: base active alone is never proof a machine is usable. Current status is separate from the requested historical plan date; plan rows do not establish confirmed physical custody.",
        inputSchema: z.object({ date: z.string().optional() }),
        execute: async (input: { date?: string }) => adminAnalyzeDailyPlanLicenses(requester, { date: assistantToolDate(turn, input.date) ?? turn.today }),
      },
      adminQueryDailyPlan: {
        description:
          "Admin only: recorded daily-plan groups with site, workers and machines. Planned assignment is not confirmed asset custody or current usability. In steel companies use operationalAvailability/usable and warnings, not base active alone; status is current even for a historical plan. Saved unresolved names never establish asset availability.",
        inputSchema: z.object({ date: z.string().optional(), workerName: z.string().optional(), baustelleName: z.string().optional() }),
        execute: async (input: { date?: string; workerName?: string; baustelleName?: string }) =>
          adminQueryDailyPlan(requester, { ...input, date: assistantToolDate(turn, input.date) ?? turn.today }),
      },
      adminListVacationRequests: {
        description:
          "Admin only: vacation requests from worker profiles. Default status PENDING for open requests; status ALL/APPROVED/REJECTED possible. Optional date YYYY-MM-DD for requests affecting that day. Answer briefly and without links.",
        inputSchema: z.object({
          status: z.enum(["PENDING", "APPROVED", "REJECTED", "ALL"]).optional(),
          date: z.string().optional(),
          limit: z.number().optional(),
        }),
        execute: async (input: { status?: "PENDING" | "APPROVED" | "REJECTED" | "ALL"; date?: string; limit?: number }) =>
          adminListVacationRequests(requester, { ...input, date: assistantToolDate(turn, input.date) }),
      },
      adminGetHoursAggregate: {
        description: "Admin only: total working hours for today, month, or date range; optionally grouped by worker.",
        inputSchema: z.object({
          period: z.enum(["today", "month", "range"]),
          referenceDate: z.string().optional(),
          rangeFrom: z.string().optional(),
          rangeTo: z.string().optional(),
          groupByWorker: z.boolean().optional(),
        }),
        execute: async (input: {
          period: "today" | "month" | "range";
          referenceDate?: string;
          rangeFrom?: string;
          rangeTo?: string;
          groupByWorker?: boolean;
        }) => {
          if (!turnDate) return adminGetHoursAggregate(requester, input);
          if (input.period === "range") {
            return adminGetHoursAggregate(requester, {
              ...input,
              rangeFrom: turnDate,
              rangeTo: turnDate,
            });
          }
          return adminGetHoursAggregate(requester, { ...input, referenceDate: turnDate });
        },
      },
      adminSearchWorkersByLicense: {
        description: "Admin only: find workers whose profile licenses field contains a text such as CE, C, or truck.",
        inputSchema: z.object({ contains: z.string() }),
        execute: async (input: { contains: string }) => adminSearchWorkersByLicense(requester, input),
      },
      adminGetHoursRanking: {
        description: "Admin only: ranking by hours in a calendar month (YYYY-MM).",
        inputSchema: z.object({ yearMonth: z.string(), limit: z.number().optional() }),
        execute: async (input: { yearMonth: string; limit?: number }) => adminGetHoursRanking(requester, input),
      },
      adminListBaustellenOverview: {
        description: "Admin only: sites with status, trees todo/done, document names, and short description.",
        inputSchema: z.object({ status: z.enum(["active", "inactive"]).optional() }),
        execute: async (input: { status?: "active" | "inactive" }) => adminListBaustellenOverview(requester, input),
      },
      adminListProjects: {
        description: "Admin only: calculation projects with title, customer, status, date, and internal notes excerpt.",
        inputSchema: z.object({ limit: z.number().optional(), status: z.string().optional() }),
        execute: async (input: { limit?: number; status?: string }) => adminListProjects(requester, input),
      },
      adminListOpenManualTasks: {
        description: "Admin only: recent recorded manual task entries per site. The legacy tool name does not establish whether each task is open or closed.",
        inputSchema: z.object({ limit: z.number().optional() }),
        execute: async (input: { limit?: number }) => adminListOpenManualTasks(requester, input),
      },
  };
  const workerOnly = ['getMyOperationalSnapshot','getMyHoursSummary','getMyDailyReport','getMyMonthlyTimesheet','getMyVacationSummary'];
  const legacySteel = ['getEquipmentStatus','adminGetDashboardSnapshot','adminListBaustellenOverview','adminListProjects','adminGetTeamDailyReport','adminGetWorkerDailyReport','adminGetOwnDailyReport'];
  return Object.fromEntries(Object.entries(tools).filter(([name]) => !workerOnly.includes(name) && !(steel && legacySteel.includes(name))));
}
