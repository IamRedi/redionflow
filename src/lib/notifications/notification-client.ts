"use client";

import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

import { LANGUAGE_COOKIE, normalizeLanguage } from "@/lib/i18n/language";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
};

function hasFirebaseConfig() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId);
}

function notificationLanguage() {
  const cookieValue = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LANGUAGE_COOKIE}=`))
    ?.split("=")[1];
  return normalizeLanguage(cookieValue ? decodeURIComponent(cookieValue) : null) ?? "de";
}

function notificationMessages() {
  const lang = notificationLanguage();
  const messages = {
    de: {
      browserUnsupported: "Push-Benachrichtigungen werden von diesem Browser nicht unterstuetzt.",
      firebaseMissing: "Firebase Push ist noch nicht konfiguriert.",
      deviceUnsupported: "Push-Benachrichtigungen sind auf diesem Geraet nicht verfuegbar.",
      permissionDenied: "Benachrichtigungen wurden nicht aktiviert.",
      tokenCreateFailed: "Firebase Push-Token konnte nicht erstellt werden. Bitte Firebase API-Key und Cloud Messaging pruefen.",
      noToken: "Push-Token konnte nicht erstellt werden.",
      tokenSaveFailed: "Push-Token konnte nicht gespeichert werden.",
      enabled: "Benachrichtigungen sind aktiv.",
    },
    en: {
      browserUnsupported: "Push notifications are not supported by this browser.",
      firebaseMissing: "Firebase Push is not configured yet.",
      deviceUnsupported: "Push notifications are not available on this device.",
      permissionDenied: "Notifications were not enabled.",
      tokenCreateFailed: "Firebase push token could not be created. Check the Firebase API key and Cloud Messaging.",
      noToken: "Push token could not be created.",
      tokenSaveFailed: "Push token could not be saved.",
      enabled: "Notifications are active.",
    },
    it: {
      browserUnsupported: "Le notifiche push non sono supportate da questo browser.",
      firebaseMissing: "Firebase Push non e ancora configurato.",
      deviceUnsupported: "Le notifiche push non sono disponibili su questo dispositivo.",
      permissionDenied: "Le notifiche non sono state attivate.",
      tokenCreateFailed: "Impossibile creare il token push Firebase. Controlla API key Firebase e Cloud Messaging.",
      noToken: "Impossibile creare il token push.",
      tokenSaveFailed: "Impossibile salvare il token push.",
      enabled: "Le notifiche sono attive.",
    },
    sq: {
      browserUnsupported: "Push notifications nuk mbeshteten nga ky browser.",
      firebaseMissing: "Firebase Push nuk eshte konfiguruar ende.",
      deviceUnsupported: "Push notifications nuk jane te disponueshme ne kete pajisje.",
      permissionDenied: "Njoftimet nuk u aktivizuan.",
      tokenCreateFailed: "Firebase push-token nuk mund te krijohej. Kontrollo Firebase API key dhe Cloud Messaging.",
      noToken: "Push-token nuk mund te krijohej.",
      tokenSaveFailed: "Push-token nuk mund te ruhej.",
      enabled: "Njoftimet jane aktive.",
    },
    ro: {
      browserUnsupported: "Notificarile push nu sunt acceptate de acest browser.",
      firebaseMissing: "Firebase Push nu este configurat inca.",
      deviceUnsupported: "Notificarile push nu sunt disponibile pe acest dispozitiv.",
      permissionDenied: "Notificarile nu au fost activate.",
      tokenCreateFailed: "Tokenul push Firebase nu a putut fi creat. Verifica Firebase API key si Cloud Messaging.",
      noToken: "Tokenul push nu a putut fi creat.",
      tokenSaveFailed: "Tokenul push nu a putut fi salvat.",
      enabled: "Notificarile sunt active.",
    },
    pl: {
      browserUnsupported: "Powiadomienia push nie sa obslugiwane przez ta przegladarke.",
      firebaseMissing: "Firebase Push nie jest jeszcze skonfigurowany.",
      deviceUnsupported: "Powiadomienia push nie sa dostepne na tym urzadzeniu.",
      permissionDenied: "Powiadomienia nie zostaly wlaczone.",
      tokenCreateFailed: "Nie mozna utworzyc tokenu push Firebase. Sprawdz Firebase API key i Cloud Messaging.",
      noToken: "Nie mozna utworzyc tokenu push.",
      tokenSaveFailed: "Nie mozna zapisac tokenu push.",
      enabled: "Powiadomienia sa aktywne.",
    },
  } as const;
  return messages[lang];
}

export async function enableNotifications() {
  const m = notificationMessages();
  if (!("Notification" in window)) {
    return { ok: false, message: m.browserUnsupported };
  }

  if (!hasFirebaseConfig() || !process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) {
    return { ok: false, message: m.firebaseMissing };
  }

  const supported = await isSupported();
  if (!supported || !("serviceWorker" in navigator)) {
    return { ok: false, message: m.deviceUnsupported };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, message: m.permissionDenied };
  }

  let fcmToken: string | null = null;
  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const app = getApps()[0] ?? initializeApp(firebaseConfig);
    const messaging = getMessaging(app);
    fcmToken = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY.trim(),
      serviceWorkerRegistration: registration,
    });
  } catch (error) {
    console.error("[notifications] FCM token failed", error);
    return { ok: false, message: m.tokenCreateFailed };
  }

  if (!fcmToken) {
    return { ok: false, message: m.noToken };
  }

  const response = await fetch("/api/notifications/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fcmToken }),
  }).catch(() => null);

  if (!response?.ok) {
    return { ok: false, message: m.tokenSaveFailed };
  }

  return { ok: true, message: m.enabled };
}
