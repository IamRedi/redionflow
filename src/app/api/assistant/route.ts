import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { z } from "zod";
import { NextResponse } from "next/server";
import { stepCountIs, streamText } from "ai";
import { openai } from "@ai-sdk/openai";

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
import { ensureLoginAllowed, getClientIp, registerFailedLogin } from "@/lib/auth/login-guard";
import { canImpersonateTarget, extractAddressedName, resolveIdentityTarget } from "@/lib/assistant/identity";
import { ASSISTANT_LANGUAGE_CODES, assistantLanguagePromptLabel, languageForTurn, type AssistantLanguageCode } from "@/lib/assistant/language";
import { getRequesterContext } from "@/lib/assistant/requester";
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

export const runtime = "nodejs";

const bodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    }),
  ),
});

function todayKey() {
  const date = new Date();
  return dateKeyFromDate(date);
}

function dateKeyFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function offsetDateKey(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateKeyFromDate(date);
}

function currentMonthKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function asksForToday(text: string) {
  return /\b(sot|heute|today|aktuell|aktualisht|jetzt|now)\b/i.test(text);
}

function asksForYesterday(text: string) {
  return /\b(dje|gestern|yesterday)\b/i.test(text);
}

function asksForTomorrow(text: string) {
  return /\b(neser|nesër|morgen|tomorrow)\b/i.test(text);
}

function relativeDateForTurn(text: string) {
  if (asksForYesterday(text)) return offsetDateKey(-1);
  if (asksForTomorrow(text)) return offsetDateKey(1);
  if (asksForToday(text)) return todayKey();
  return null;
}

function asksForCurrentMonth(text: string) {
  return /\b(aktueller monat|current month|diesen monat|kete muaj|këtë muaj|muaji aktual)\b/i.test(text);
}

function previousUserMessages(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
  return messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .slice(-4);
}

function looksLikeShortFollowUp(text: string) {
  const normalized = text.trim().toLowerCase();
  return (
    normalized.length <= 28 &&
    /\b(po|edhe|dhe|und|auch|dje|gestern|yesterday|sot|heute|today|neser|nes.r|morgen|tomorrow)\b/i.test(normalized)
  );
}

function operationalQuestionHint(text: string) {
  if (/\b(or.t?|stunden|hours|punuan|punoi|arbeitet|worked|ranking|statistik|statistika)\b/i.test(text)) return "hours/stats";
  if (/\b(ku|wo|where|baustelle|kantier|standort|location)\b/i.test(text)) return "location/site";
  if (/\b(kur|wann|when|start|filloi|begann|mbaroi|ende|stop)\b/i.test(text)) return "time/report";
  if (/\b(kush|wer|who|pun.tor|mitarbeiter|worker|team)\b/i.test(text)) return "team/workers";
  return "general";
}

function adminPersonaAccessError(lang: AssistantLanguageCode) {
  if (lang === "SQ") return "Nuk ke te drejte te flasesh si Admin. Hyr si Admin.";
  if (lang === "EN") return "No access: admin persona is only available to admins.";
  if (lang === "IT") return "Accesso negato: la persona admin e disponibile solo agli admin.";
  if (lang === "RO") return "Fara acces: persona de admin este disponibila doar pentru admini.";
  if (lang === "PL") return "Brak dostepu: persona admina jest dostepna tylko dla adminow.";
  return "Kein Zugriff: Admin-Persona nur fuer Admins.";
}

function adminOnlyError(lang: AssistantLanguageCode) {
  if (lang === "SQ") return "Nuk ka akses: Assistant-i eshte vetem per administrator.";
  if (lang === "EN") return "No access: the assistant is only available to administrators.";
  if (lang === "IT") return "Accesso negato: l'assistente e disponibile solo per gli amministratori.";
  if (lang === "RO") return "Fara acces: asistentul este disponibil doar pentru administratori.";
  if (lang === "PL") return "Brak dostepu: asystent jest dostepny tylko dla administratorow.";
  return "Kein Zugriff: Der Assistant ist nur fuer Administratoren verfuegbar.";
}

function missingApiKeyError(lang: AssistantLanguageCode) {
  if (lang === "SQ") return 'Mungon OPENAI_API_KEY. Vendose ne `.env` dhe rinis dev-serverin.';
  if (lang === "EN") return 'OPENAI_API_KEY is missing. Set it in `.env` and restart the dev server.';
  if (lang === "IT") return 'OPENAI_API_KEY mancante. Impostala in `.env` e riavvia il dev server.';
  if (lang === "RO") return 'OPENAI_API_KEY lipseste. Seteaz-o in `.env` si reporneste dev serverul.';
  if (lang === "PL") return 'Brakuje OPENAI_API_KEY. Ustaw go w `.env` i uruchom ponownie dev server.';
  return 'OPENAI_API_KEY fehlt. Bitte in `.env` setzen und den Dev-Server neu starten.';
}

function invalidRequestError(lang: AssistantLanguageCode) {
  if (lang === "SQ") return "Kerkese e pavlefshme.";
  if (lang === "EN") return "Invalid request.";
  if (lang === "IT") return "Richiesta non valida.";
  if (lang === "RO") return "Cerere invalida.";
  if (lang === "PL") return "Nieprawidlowe zadanie.";
  return "Ungueltige Anfrage.";
}

function rateLimitedError(lang: AssistantLanguageCode, retryAfterSeconds: number) {
  const s = retryAfterSeconds;
  if (lang === "SQ") return `Shume kerkesa. Provo perseri pas ${s}s.`;
  if (lang === "EN") return `Too many requests. Try again in ${s}s.`;
  if (lang === "IT") return `Troppe richieste. Riprova tra ${s}s.`;
  if (lang === "RO") return `Prea multe cereri. Reincearca in ${s}s.`;
  if (lang === "PL") return `Za duzo zapytan. Sprobuj za ${s}s.`;
  return `Zu viele Anfragen. Bitte in ${s}s erneut versuchen.`;
}

function defaultAssistantStyle(lang: AssistantLanguageCode, targetType?: string) {
  const adminStyle = {
    DE: "Du bist ein praeziser, professioneller Admin-Kollege. Antworte kurz, datenbasiert und in der gewaehlten Sprache.",
    EN: "You are a precise, professional admin colleague. Answer briefly, data-based, and in the selected language.",
    IT: "Sei un collega admin preciso e professionale. Rispondi in modo breve, basato sui dati e nella lingua selezionata.",
    SQ: "Je nje koleg admin i sakte dhe profesional. Pergjigju shkurt, me baze ne te dhena dhe ne gjuhen e zgjedhur.",
    RO: "Esti un coleg admin precis si profesionist. Raspunde scurt, bazat pe date si in limba selectata.",
    PL: "Jestes precyzyjnym, profesjonalnym kolega adminem. Odpowiadaj krotko, na podstawie danych i w wybranym jezyku.",
  } as const;
  const workerStyle = {
    DE: "Du bist ein kollegialer Baustellen-Mitarbeiter. Antworte kurz, praktisch und in der gewaehlten Sprache.",
    EN: "You are a collegial field worker. Answer briefly, practically, and in the selected language.",
    IT: "Sei un worker di cantiere collaborativo. Rispondi in modo breve, pratico e nella lingua selezionata.",
    SQ: "Je nje worker/koleg ne kantier. Pergjigju shkurt, praktikisht dhe ne gjuhen e zgjedhur.",
    RO: "Esti un lucrator de santier colegial. Raspunde scurt, practic si in limba selectata.",
    PL: "Jestes kolezenskim pracownikiem terenowym. Odpowiadaj krotko, praktycznie i w wybranym jezyku.",
  } as const;
  return targetType === "admin" ? adminStyle[lang] : workerStyle[lang];
}

export async function POST(req: Request) {
  const originDenied = rejectCrossOriginMutation(req);
  if (originDenied) return originDenied;
  const requester = await getRequesterContext();
  const fallbackLanguage = requester.preferredLanguage;
  if ((requester as { kind: string }).kind !== "admin") {
    return NextResponse.json({ error: adminOnlyError(fallbackLanguage) }, { status: 403 });
  }

  // BDF-P8-007: rate-limit assistant POSTs so a scripted bot cannot
  // run up OpenAI cost. Legit conversation stays well under the ceiling.
  const clientIp = getClientIp(req.headers);
  const access = await ensureLoginAllowed("assistant", clientIp);
  if (!access.ok) {
    return NextResponse.json(
      { error: rateLimitedError(fallbackLanguage, access.retryAfterSeconds) },
      { status: 429, headers: { "Retry-After": String(access.retryAfterSeconds) } },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error: missingApiKeyError(fallbackLanguage),
      },
      { status: 500 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    await registerFailedLogin("assistant", clientIp);
    return NextResponse.json({ error: invalidRequestError(fallbackLanguage) }, { status: 400 });
  }

  const lastUser = [...parsed.data.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const recentUsers = previousUserMessages(parsed.data.messages);
  const currentDate = todayKey();
  const yesterdayDate = offsetDateKey(-1);
  const tomorrowDate = offsetDateKey(1);
  const turnDate = relativeDateForTurn(lastUser);
  const currentMonth = currentMonthKey();
  const shortFollowUp = looksLikeShortFollowUp(lastUser);
  const previousUser = recentUsers.length > 1 ? recentUsers[recentUsers.length - 2] : "";
  const inferredTopic = operationalQuestionHint(shortFollowUp && previousUser ? previousUser : lastUser);
  const turnLanguage = languageForTurn(requester, lastUser);
  const addressedName = extractAddressedName(lastUser);
  const target = await resolveIdentityTarget({ companyId: requester.companyId, addressedName });
  const policy = { allowSensitiveWorkerData: true, allowSensitiveAdminData: true };

  if (!canImpersonateTarget(requester, target)) {
    return NextResponse.json(
      {
        error: adminPersonaAccessError(turnLanguage),
      },
      { status: 403 },
    );
  }

  const targetName = target?.displayName ?? "Team";
  const systemStyle =
    target?.aiPersonalityNote?.trim() ||
    defaultAssistantStyle(turnLanguage, target?.type);

  const workerScope =
    requester.kind === "worker"
      ? `\nWORKER SCOPE (strict):\n- Current date: ${currentDate}. Current month: ${currentMonth}.\n- For "sot/heute/today", always use ${currentDate}; do not guess an old date.\n- Own hours: getMyHoursSummary (days optional).\n- Own daily report: getMyDailyReport (date YYYY-MM-DD optional, default today).\n- Own monthly timesheet: getMyMonthlyTimesheet (month YYYY-MM optional, default current month).\n- Own live location/plan: getMyOperationalSnapshot for "ku je?" / "wo bin ich?" / "where am I?".\n- Public Workzone directory: getCompanyBaustellenDirectory.\n- Colleagues: only operational info such as live location, assigned machine, equipment. Never expose other workers' hours, HR data, daily reports, timesheets, or private notes.\n- Do not use adminGet* tools. Do not expose team totals, rankings, project internals, or full license lists.\nRequester: "${requester.displayName}".\n`
      : `\nADMIN SCOPE (full read-only data through tools; never invent data):\n- Current date: ${currentDate}. Current month: ${currentMonth}.\n- For "sot/heute/today", always use ${currentDate}; do not guess an old date.\n- For dashboard/KPI/panel questions, first use adminGetDashboardSnapshot. It is the preferred source for numbers shown in the admin dashboard.\n- If dashboard snapshot data is available, do not invent other totals or mix in unrelated numbers. State clearly when numbers come from the snapshot.\n- Who is working now / how many are live? -> adminGetLiveWorkforce.\n- Daily plan: who is assigned to which machine and site? -> adminQueryDailyPlan.\n- Check daily plan against worker licenses/machine requirements -> adminAnalyzeDailyPlanLicenses.\n- If the question asks for worker + machine + site in the daily plan, always use adminQueryDailyPlan and mention worker, machines, and site.\n- Hours today / this month / range totals -> adminGetHoursAggregate.\n- Hours for all workers in a range -> adminGetHoursAggregate with period range + groupByWorker.\n- Worker profile link -> derive from adminGetWorkerDailyReport/adminGetWorkerMonthlyTimesheet or getWorkerHrProfile when asked.\n- Worker daily report -> adminGetWorkerDailyReport (workerName, date optional). For "sot/heute/today", omit date or use ${currentDate}.\n- Team daily report / who did trees today / who did what today -> adminGetTeamDailyReport. For details about one person, then use adminGetWorkerDailyReport.\n- Worker monthly timesheet -> adminGetWorkerMonthlyTimesheet (workerName, month optional). For current month, omit month or use ${currentMonth}.\n- Own admin daily report -> adminGetOwnDailyReport (date optional).\n- Who worked the most in a month -> adminGetHoursRanking (yearMonth YYYY-MM).\n- Who has license X (for example CE) -> adminSearchWorkersByLicense.\n- Single worker private hours summary -> getWorkerPrivateSummary.\n- HR/license/profile text -> getWorkerHrProfile.\n- Single live location or assigned machine -> getLiveLocation / getAssignedMachine.\n- Site overview, open/done trees, documents -> adminListBaustellenOverview.\n- Calculation projects -> adminListProjects.\n- Open/manual site tasks -> adminListOpenManualTasks.\n- There is no fixed deadline field per site. Deadlines only exist if they are in description, notes, or documents; say honestly when none is stored.\n`;

  const contextLogic = `\nWORK-CONTEXT LOGIC:\n- Most questions are about work, statistics, hours, daily plan, workers, sites, machines, and reports. Treat short questions in that operational context, not as small talk.\n- Recent user questions: ${recentUsers.map((m) => `"${m.replace(/\s+/g, " ").slice(0, 120)}"`).join(" | ") || "(none)"}.\n- Current user question is ${shortFollowUp ? "a short follow-up" : "a standalone question"}. Inferred topic: ${inferredTopic}.\n- Relative dates: today=${currentDate}, yesterday=${yesterdayDate}, tomorrow=${tomorrowDate}. If the question contains "dje/gestern/yesterday", use ${yesterdayDate}. If it contains "neser/morgen/tomorrow", use ${tomorrowDate}.\n- Short follow-ups like "po dje", "edhe dje", "und gestern", or "sot?" inherit the intent of the previous user question. Example: after "sa ore punuan punetoret?", "po dje" means the same hours analysis for yesterday.\n- For questions about hours, who worked, or what was done, always use a data tool. Do not answer with generic excuses.\n- Never say "capacity maximum" or similar fallback text unless the API request itself truly failed. If data is missing, say briefly which data was not found.\n`;

  const result = streamText({
    model: openai("gpt-4o-mini"),
    stopWhen: stepCountIs(14),
    system: `You are the identity-aware Team Assistant. Always speak as the addressed persona when a persona is addressed.\n\nRequester: ${requester.displayName} (${requester.kind})\nPersona: ${targetName}${target?.type ? ` (${target.type})` : ""}\nPersona note: ${systemStyle}\n${workerScope}${contextLogic}\nDual-Identity Privacy Logic (STRICT):\n- Decide every answer from Requester identity (bk_admin_id / bk_worker_id) and Target Persona.\n- Admin: may use admin, HR, project, and report tools listed above, but remains read-only.\n- Worker: only own person + public Workzone sites + operational team info.\n- Worker to worker: only operational data such as location, machine, and material. Never expose sensitive HR data, hours, daily reports, timesheets, or private notes of another person.\n- Worker to admin: only answer within worker scope; no admin-only internals.\n- If unsure, ask a clarifying question or give a short safe answer.\n\nWording:\n- Answer naturally in first person of the persona when a persona was addressed.\n- Keep answers short, human, and clear. Do not list tool names stiffly.\n- For vacation/availability, do not output links unless the user explicitly asks for a link.\n\nSystem Flags:\n- allowSensitiveWorkerData: ${policy.allowSensitiveWorkerData ? "yes" : "no"}\n- allowSensitiveAdminData: ${policy.allowSensitiveAdminData ? "yes" : "no"}\n\nRules:\n- Read-only: never write or change data.\n- Use tools for data; do not hallucinate numbers.\n- Core principle: the assistant may see what the same logged-in user/admin could see in the UI with the mouse, but not more.\n- Response language: ${assistantLanguagePromptLabel(turnLanguage)}.\n`,
    messages: parsed.data.messages,
    tools: {
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
        execute: async (input: { date?: string }) => getMyDailyReport(requester, { date: turnDate ?? input.date }),
      },
      getMyMonthlyTimesheet: {
        description:
          "Worker only: own monthly timesheet as shown in the UI, including day rows, local start/end times, breaks, sites, live hours so far, admin time rows, and notes. Optional month as YYYY-MM.",
        inputSchema: z.object({ month: z.string().optional() }),
        execute: async (input: { month?: string }) => getMyMonthlyTimesheet(requester, { month: asksForCurrentMonth(lastUser) ? currentMonth : input.month }),
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
        execute: async (input: { workerName: string; date?: string }) => getAssignedMachine(requester, { ...input, date: turnDate ?? input.date }),
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
          adminGetWorkerDailyReport(requester, { ...input, date: turnDate ?? input.date }),
      },
      adminGetTeamDailyReport: {
        description:
          "Admin only: team daily report for a date. Use for questions such as who completed trees today, how many trees per worker, who worked today, or who had material actions. Returns all active daily data from one source.",
        inputSchema: z.object({ date: z.string().optional() }),
        execute: async (input: { date?: string }) => adminGetTeamDailyReport(requester, { date: turnDate ?? input.date }),
      },
      adminGetWorkerMonthlyTimesheet: {
        description:
          "Admin only: worker monthly timesheet as shown in the UI. Includes day rows, local start/end times, live total hours so far, admin time rows, and notes. workerName required, month optional YYYY-MM.",
        inputSchema: z.object({ workerName: z.string(), month: z.string().optional() }),
        execute: async (input: { workerName: string; month?: string }) =>
          adminGetWorkerMonthlyTimesheet(requester, { ...input, month: asksForCurrentMonth(lastUser) ? currentMonth : input.month }),
      },
      adminGetOwnDailyReport: {
        description: "Admin only: own admin daily report as shown in the UI, including own tasks and completed trees. date optional YYYY-MM-DD.",
        inputSchema: z.object({ date: z.string().optional() }),
        execute: async (input: { date?: string }) => adminGetOwnDailyReport(requester, { date: turnDate ?? input.date }),
      },
      getCompanyBaustellenDirectory: {
        description: "Active company sites: name, type, address, and short description. Available to workers and admins.",
        inputSchema: z.object({}),
        execute: async () => getCompanyBaustellenDirectory(requester),
      },
      adminGetLiveWorkforce: {
        description: "Admin only: all workers currently clocked in live, site, and since when.",
        inputSchema: z.object({}),
        execute: async () => adminGetLiveWorkforce(requester),
      },
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
        execute: async (input: { date?: string }) => adminGetAvailabilityForDate(requester, { date: turnDate ?? input.date }),
      },
      adminAnalyzeDailyPlanLicenses: {
        description:
          "Admin only: analyzes the daily plan for a date against worker licenses/driver permissions and machine requirements. Use for questions such as whether licenses match machines, who is planned with which machine, or whether the plan makes sense.",
        inputSchema: z.object({ date: z.string().optional() }),
        execute: async (input: { date?: string }) => adminAnalyzeDailyPlanLicenses(requester, { date: turnDate ?? input.date }),
      },
      adminQueryDailyPlan: {
        description:
          "Admin only: reads the daily plan for a date and returns groups with site, workers, and machines. Use for questions such as which machines Noah/Mario had today, who is on Prio 1 site, or which machine is planned for a site.",
        inputSchema: z.object({ date: z.string().optional(), workerName: z.string().optional(), baustelleName: z.string().optional() }),
        execute: async (input: { date?: string; workerName?: string; baustelleName?: string }) =>
          adminQueryDailyPlan(requester, { ...input, date: turnDate ?? input.date }),
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
          adminListVacationRequests(requester, { ...input, date: turnDate ?? input.date }),
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
              rangeFrom: input.rangeFrom ?? turnDate,
              rangeTo: input.rangeTo ?? turnDate,
            });
          }
          return adminGetHoursAggregate(requester, { ...input, referenceDate: input.referenceDate ?? turnDate });
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
        description: "Admin only: marked/open manual tasks per site.",
        inputSchema: z.object({ limit: z.number().optional() }),
        execute: async (input: { limit?: number }) => adminListOpenManualTasks(requester, input),
      },
    },
  });

  return result.toTextStreamResponse();
}
