import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getOrCreateDefaultCompany } from "@/lib/db/company";
import { prisma } from "@/lib/db/prisma";
import { createGpsLocationPointSafe, nearestBaustelleForPoint } from "@/lib/workzone/fleet-gps";
import { findPauseIntervalsForSession } from "@/lib/workzone/pause-interval-store";
import { hasOpenPause } from "@/lib/workzone/session-rules";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { resolveRequestLanguage } from "@/lib/i18n/server";

type GpsLang = "de" | "en" | "it" | "sq";

function normalizeGpsLang(lang: string): GpsLang {
  return lang === "en" || lang === "it" || lang === "sq" ? lang : "de";
}

function gpsMessages(lang: string) {
  const selected = normalizeGpsLang(lang);
  const messages = {
    de: {
      unauthorized: "Anmeldung erforderlich.",
      invalidPayload: "GPS-Daten sind ungueltig.",
      disabled: "Worker-Telefon-GPS ist deaktiviert.",
      noActiveSession: "Keine aktive Session.",
      sessionPaused: "Session ist pausiert.",
      invalidRecordedAt: "Zeitpunkt ist ungueltig.",
      databaseNotReady: "GPS-Datenbank ist noch nicht bereit.",
    },
    en: {
      unauthorized: "Sign-in required.",
      invalidPayload: "Invalid GPS payload.",
      disabled: "Worker phone GPS is disabled.",
      noActiveSession: "No active session.",
      sessionPaused: "Session is paused.",
      invalidRecordedAt: "Invalid recorded time.",
      databaseNotReady: "GPS database is not ready.",
    },
    it: {
      unauthorized: "Accesso richiesto.",
      invalidPayload: "Dati GPS non validi.",
      disabled: "Il GPS del telefono worker e disattivato.",
      noActiveSession: "Nessuna sessione attiva.",
      sessionPaused: "La sessione e in pausa.",
      invalidRecordedAt: "Orario registrato non valido.",
      databaseNotReady: "Il database GPS non e ancora pronto.",
    },
    sq: {
      unauthorized: "Duhet te hysh.",
      invalidPayload: "Te dhena GPS te pavlefshme.",
      disabled: "GPS i telefonit te workerit eshte i caktivizuar.",
      noActiveSession: "Nuk ka sesion aktiv.",
      sessionPaused: "Sesioni eshte ne pauze.",
      invalidRecordedAt: "Koha e regjistrimit eshte e pavlefshme.",
      databaseNotReady: "Databaza GPS nuk eshte ende gati.",
    },
  } as const;
  return messages[selected];
}

const workerGpsSchema = z.object({
  sessionId: z.string().min(1),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  accuracyMeters: z.coerce.number().min(0).max(10000).optional(),
  speedKmh: z.coerce.number().min(0).max(300).optional(),
  headingDeg: z.coerce.number().min(0).max(360).optional(),
  recordedAt: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  const originDenied = rejectCrossOriginMutation(request);
  if (originDenied) return originDenied;
  const m = gpsMessages(await resolveRequestLanguage());
  const worker = await getCurrentWorker();
  if (!worker || worker.status !== "active") {
    return NextResponse.json({ ok: false, message: m.unauthorized }, { status: 401 });
  }

  const parsed = workerGpsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: m.invalidPayload }, { status: 400 });

  const company = await getOrCreateDefaultCompany();
  if (company.id !== worker.companyProfileId || !company.workerPhoneGpsEnabled) {
    return NextResponse.json({ ok: false, message: m.disabled }, { status: 403 });
  }

  const session = await prisma.workSession.findFirst({
    where: {
      id: parsed.data.sessionId,
      workerId: worker.id,
      isLive: true,
      endTime: null,
    },
  });
  if (!session) return NextResponse.json({ ok: false, message: m.noActiveSession }, { status: 409 });
  const pauseIntervals = await findPauseIntervalsForSession(session.id);
  if (hasOpenPause(pauseIntervals)) {
    return NextResponse.json({ ok: false, message: m.sessionPaused }, { status: 409 });
  }

  const recordedAt = parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : new Date();
  if (Number.isNaN(recordedAt.getTime())) {
    return NextResponse.json({ ok: false, message: m.invalidRecordedAt }, { status: 400 });
  }

  const baustelle = await nearestBaustelleForPoint(worker.companyProfileId, {
    lat: parsed.data.lat,
    lng: parsed.data.lng,
  });

  const matchedBaustelleId = baustelle?.id ?? session.baustelleId ?? null;
  const point = await createGpsLocationPointSafe({
    companyProfileId: worker.companyProfileId,
    workerId: worker.id,
    workSessionId: session.id,
    baustelleId: matchedBaustelleId,
    source: "WORKER_PHONE",
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    accuracyMeters: parsed.data.accuracyMeters,
    speedKmh: parsed.data.speedKmh,
    headingDeg: parsed.data.headingDeg,
    recordedAt,
  });
  if (!point) return NextResponse.json({ ok: false, message: m.databaseNotReady }, { status: 503 });

  if (!session.baustelleId && baustelle?.id) {
    await prisma.workSession.update({ where: { id: session.id }, data: { baustelleId: baustelle.id } });
  }

  return NextResponse.json({ ok: true, baustelleId: matchedBaustelleId });
}
