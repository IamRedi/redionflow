"use server";

import { revalidatePath } from "next/cache";
import { XMLParser } from "fast-xml-parser";
import { readSpreadsheetRows } from "@/lib/import/spreadsheet";
import { validateManagedUpload } from "@/lib/storage/upload-validation";

import { Prisma } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { getAdminCompanyId as getCurrentCompanyId } from "@/lib/auth/authorization";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import { planPendingImport, uploadPendingImport, pendingImportReferences, abortPendingImport, finalizePendingImport, type PendingImport } from "@/lib/storage/object-storage";
import { formatCount } from "@/lib/workzone/date-utils";

type ImportResult =
  | { ok: true; message: string; importedCount: number; baustelleId: string }
  | { ok: false; message: string };

type ImportRow = Record<string, string>;

type KmlTree = {
  name: string;
  extended: Record<string, string>;
  coordinates: { lat: number; lng: number; latitude: number; longitude: number } | null;
};

type ImportedTreeItem = {
  treeId: string;
  species: string;
  diameter: number;
  coordinates: { lat: number; lng: number; latitude: number; longitude: number } | typeof Prisma.JsonNull;
  status: "todo";
  notes: string | null;
};

const DATA_FILE_EXTENSIONS = [".xlsx", ".xls", ".csv"];

const FIELD_ALIASES = {
  treeId: ["baumnummer", "baum nummer", "treeid", "tree id", "baum_id", "baum id", "interne nr", "nr", "id"],
  species: ["art", "gattung", "species", "baumart", "baumart_art_deutsch", "baumart deutsch"],
  diameter: ["stu", "stammumfang", "diameter", "stammdurchmesser", "stammdurchmesser_aktuell", "durchmesser"],
  measure: ["massnahme", "maßnahme"],
  priority: ["prioritat", "priorität"],
  object: ["objekt"],
};

function normalizeText(value: string) {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase();
}

function compact(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

function normalizeImportId(id: unknown) {
  return id?.toString().replace(/[\u200b-\u200d\ufeff]/g, "").trim().replace(/^0+/, "") ?? "";
}

function importIdCandidates(id: unknown) {
  const normalized = normalizeImportId(id);
  if (!normalized) return [];

  const candidates = new Set<string>([normalized, compact(normalized)]);

  return Array.from(candidates).filter(Boolean);
}

type ExistingTreeItem = {
  id: string;
  treeId: string;
  species: string;
  diameter: number;
  coordinates: Prisma.JsonValue | null;
};

function rememberExistingTree(index: Map<string, ExistingTreeItem>, tree: ExistingTreeItem) {
  for (const candidate of importIdCandidates(tree.treeId)) {
    if (!index.has(candidate)) index.set(candidate, tree);
  }
}

function findExistingTree(index: Map<string, ExistingTreeItem>, treeId: string) {
  for (const candidate of importIdCandidates(treeId)) {
    const existingTree = index.get(candidate);
    if (existingTree) return existingTree;
  }

  return null;
}

function isKmlIdField(fieldName: string) {
  const normalizedFieldName = compact(fieldName);

  return (
    normalizedFieldName === "id" ||
    normalizedFieldName === "nr" ||
    normalizedFieldName.endsWith("id") ||
    normalizedFieldName.endsWith("nr") ||
    normalizedFieldName.includes("baumid") ||
    normalizedFieldName.includes("baumnummer") ||
    normalizedFieldName.includes("baumnr") ||
    normalizedFieldName.includes("treeid") ||
    normalizedFieldName.includes("treenumber") ||
    normalizedFieldName.includes("standortnr")
  );
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function stringifyCell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function getField(row: ImportRow, aliases: string[]) {
  const entries = Object.entries(row);
  const normalizedAliases = aliases.map((alias) => normalizeText(alias));
  const compactAliases = aliases.map((alias) => compact(alias));

  for (const alias of normalizedAliases) {
    const exact = entries.find(([key]) => normalizeText(key) === alias);
    if (exact) return exact[1].trim();
  }

  for (const alias of compactAliases) {
    const exact = entries.find(([key]) => compact(key) === alias);
    if (exact) return exact[1].trim();
  }

  for (const alias of compactAliases.filter((candidate) => candidate.length > 2)) {
    const partial = entries.find(([key]) => compact(key).includes(alias));
    if (partial) return partial[1].trim();
  }

  return "";
}

function fileExtension(filename: string) {
  return filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
}

function basenameWithoutExtension(filename: string) {
  return filename.replace(/\.[^.]+$/, "").trim() || filename;
}

function uniqueDocuments(documents: string[]) {
  return Array.from(new Set(documents.map((doc) => doc.trim()).filter(Boolean)));
}

async function readFileBuffer(file: File) {
  return Buffer.from(await file.arrayBuffer());
}

function resolveImportLanguage(formData: FormData): Language {
  const lang = String(formData.get("lang") ?? "");
  return lang === "en" || lang === "it" || lang === "sq" || lang === "de" ? lang : "de";
}

async function parseTabularFile(file: File, lang: Language) {
  const extension = fileExtension(file.name);

  if (!DATA_FILE_EXTENSIONS.includes(extension)) {
    throw new Error(t("admin.importInvalidDataFile", lang));
  }

  return readSpreadsheetRows(
    extension === ".csv" ? await file.text() : await readFileBuffer(file),
    extension.slice(1) as "xlsx" | "xls" | "csv",
  )
    .map((row) =>
      Object.entries(row).reduce<ImportRow>((normalizedRow, [key, value]) => {
        normalizedRow[String(key).trim()] = stringifyCell(value);
        return normalizedRow;
      }, {}),
    )
    .filter((row) => Object.values(row).some(Boolean));
}

function extractSimpleData(schemaData: unknown) {
  const result: Record<string, string> = {};

  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    const record = node as Record<string, unknown>;
    for (const simpleData of asArray(record.SimpleData)) {
      if (!simpleData || typeof simpleData !== "object") continue;
      const simpleRecord = simpleData as Record<string, unknown>;
      const name = stringifyCell(simpleRecord["@_name"]);
      const value = stringifyCell(simpleRecord["#text"] ?? simpleRecord.text ?? "");
      if (name && value) result[name] = value;
    }

    Object.values(record).forEach(walk);
  }

  walk(schemaData);
  return result;
}

function collectPlacemarks(node: unknown): Record<string, unknown>[] {
  if (!node || typeof node !== "object") return [];

  if (Array.isArray(node)) {
    return node.flatMap(collectPlacemarks);
  }

  const record = node as Record<string, unknown>;
  const ownPlacemarks = asArray(record.Placemark).filter(
    (placemark): placemark is Record<string, unknown> => Boolean(placemark) && typeof placemark === "object",
  );

  return [...ownPlacemarks, ...Object.values(record).flatMap(collectPlacemarks)];
}

function extractCoordinate(point: unknown) {
  if (!point || typeof point !== "object") return null;

  const coordinatesText = stringifyCell((point as Record<string, unknown>).coordinates);
  const [longitudeRaw, latitudeRaw] = coordinatesText.split(",").map((part) => part.trim());
  const longitude = Number.parseFloat(longitudeRaw);
  const latitude = Number.parseFloat(latitudeRaw);

  return Number.isFinite(longitude) && Number.isFinite(latitude)
    ? { lat: latitude, lng: longitude, latitude, longitude }
    : null;
}

function indexKml(kmlText: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    trimValues: true,
  });
  const parsed = parser.parse(kmlText) as unknown;

  return kmlTreesFromParsed(parsed).reduce<Map<string, KmlTree>>((index, tree) => {
    kmlKeys(tree).forEach((key) => {
      for (const candidate of importIdCandidates(key)) {
        index.set(candidate, tree);
      }
    });
    return index;
  }, new Map<string, KmlTree>());
}

function parseKmlTrees(kmlText: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    trimValues: true,
  });
  const parsed = parser.parse(kmlText) as unknown;
  return kmlTreesFromParsed(parsed);
}

function kmlTreesFromParsed(parsed: unknown) {
  return collectPlacemarks(parsed).map((placemark) => {
    const name = stringifyCell(placemark.name);
    const extended = extractSimpleData(placemark.ExtendedData);
    return {
      name,
      extended,
      coordinates: extractCoordinate(placemark.Point),
    };
  });
}

function kmlKeys(tree: KmlTree) {
  const keys = new Set<string>();
  if (tree.name) keys.add(tree.name);

  for (const [fieldName, value] of Object.entries(tree.extended)) {
    if (value && isKmlIdField(fieldName)) {
      keys.add(value);
    }
  }

  return keys;
}

function parseInteger(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, "").replace(",", ".").trim();
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function buildNotes(row: ImportRow, kmlTree?: KmlTree) {
  const parts = [
    getField(row, FIELD_ALIASES.measure),
    getField(row, FIELD_ALIASES.priority),
    getField(row, FIELD_ALIASES.object),
    kmlTree?.extended.Status,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : null;
}

function resolveKmlTree(index: Map<string, KmlTree>, row: ImportRow) {
  const candidates = [
    getField(row, FIELD_ALIASES.treeId),
    getField(row, ["baum_id", "baum id"]),
    getField(row, ["standort_nr", "standort nr"]),
  ]
    .flatMap(importIdCandidates)
    .filter(Boolean);

  return candidates.map((candidate) => index.get(candidate)).find(Boolean);
}

function kmlTreeId(tree: KmlTree) {
  const preferredExtendedId = Object.entries(tree.extended)
    .filter(([fieldName, value]) => value && isKmlIdField(fieldName))
    .map(([, value]) => normalizeImportId(value))
    .find(Boolean);

  return preferredExtendedId || normalizeImportId(tree.name);
}

function treeItemFromKml(tree: KmlTree): ImportedTreeItem | null {
  const treeId = kmlTreeId(tree);
  if (!treeId) return null;

  return {
    treeId,
    species: tree.extended.Baumart_Art_deutsch || tree.extended["Baumart Art deutsch"] || "Unbekannt",
    diameter: parseInteger(tree.extended.Stammdurchmesser_aktuell || tree.extended.StU || "0"),
    coordinates: tree.coordinates ?? Prisma.JsonNull,
    status: "todo",
    notes: buildNotes({}, tree),
  };
}

export async function importProjectData(formData: FormData): Promise<ImportResult> {
  const lang = resolveImportLanguage(formData);
  const dataFile = formData.get("dataFile");
  const kmlFile = formData.get("kmlFile");
  const targetBaustelleIdRaw = formData.get("targetBaustelleId");
  const targetBaustelleId =
    typeof targetBaustelleIdRaw === "string" && targetBaustelleIdRaw.trim() ? targetBaustelleIdRaw.trim() : null;
  const targetNameRaw = formData.get("targetName");
  const targetName = typeof targetNameRaw === "string" && targetNameRaw.trim() ? targetNameRaw.trim() : null;
  const hasDataFile = dataFile instanceof File && dataFile.size > 0;
  const hasKmlFile = kmlFile instanceof File && kmlFile.size > 0;

  if (!hasDataFile && !hasKmlFile) {
    return { ok: false, message: t("admin.importSelectAtLeastOneFile", lang) };
  }

  let pending: PendingImport | undefined;
  let committed = false;
  try {
    const currentCompanyId = await getCurrentCompanyId();
    if (!currentCompanyId) return { ok: false, message: t("validation.notSignedIn", lang) };
    // Preflight every document before parsing or any company/site/storage mutation.
    for (const file of [dataFile, kmlFile]) {
      if (file instanceof File && file.size > 0) await validateManagedUpload(file, "baustelle-documents");
    }
    const [rows, kmlText] = await Promise.all([
      hasDataFile && dataFile instanceof File ? parseTabularFile(dataFile, lang) : Promise.resolve<ImportRow[]>([]),
      hasKmlFile && kmlFile instanceof File ? kmlFile.text() : Promise.resolve(""),
    ]);
    const kmlTrees = kmlText ? parseKmlTrees(kmlText) : [];
    const kmlIndex = kmlText ? indexKml(kmlText) : new Map<string, KmlTree>();

    const treeItems =
      rows.length > 0
        ? rows
            .map((row) => {
              const kmlTree = resolveKmlTree(kmlIndex, row);
              const treeId = getField(row, FIELD_ALIASES.treeId) || kmlTree?.name;

              if (!treeId) return null;

              return {
                treeId,
                species:
                  getField(row, FIELD_ALIASES.species) ||
                  kmlTree?.extended.Baumart_Art_deutsch ||
                  kmlTree?.extended["Baumart Art deutsch"] ||
                  "Unbekannt",
                diameter: parseInteger(
                  getField(row, FIELD_ALIASES.diameter) || kmlTree?.extended.Stammdurchmesser_aktuell || "0",
                ),
                coordinates: kmlTree?.coordinates ?? Prisma.JsonNull,
                status: "todo" as const,
                notes: buildNotes(row, kmlTree),
              };
            })
            .filter((item): item is ImportedTreeItem => Boolean(item))
        : kmlTrees.map(treeItemFromKml).filter((item): item is ImportedTreeItem => Boolean(item));

    if (treeItems.length === 0) {
      return { ok: false, message: t("admin.importNoTreesFound", lang) };
    }

    const company = await prisma.companyProfile.findUnique({ where: { id: currentCompanyId }, select: { id: true } });
    if (!company) {
      return { ok: false, message: t("validation.noCompanyAccess", lang) };
    }

    const primaryFile = hasDataFile ? dataFile : kmlFile;
    const baustelleName = targetName ?? (primaryFile instanceof File ? basenameWithoutExtension(primaryFile.name) : t("admin.importBaustelleTitle", lang));
    const importDocuments = [
      ...(hasDataFile && dataFile instanceof File ? [dataFile] : []),
      ...(hasKmlFile && kmlFile instanceof File ? [kmlFile] : []),
    ];
    const existingBaustelle = targetBaustelleId
      ? await prisma.baustelle.findFirst({
          where: { id: targetBaustelleId, companyProfileId: company.id },
          select: { id: true, documents: true, name: true },
        })
      : await prisma.baustelle.findFirst({
          where: { companyProfileId: company.id, name: baustelleName },
          select: { id: true, documents: true, name: true },
        });

    if (targetBaustelleId && !existingBaustelle) {
      return { ok: false, message: t("admin.importActiveSiteNotFound", lang) };
    }

    const baustelle = { id: existingBaustelle?.id ?? randomUUID() };
    pending = planPendingImport(company.id, baustelle.id, importDocuments);
    await uploadPendingImport(pending, importDocuments);
    const uploadedDocuments = pendingImportReferences(pending);

    const { createdCount, updatedCount, unchangedCount } = await prisma.$transaction(async (tx) => {
      if (!pending || Date.now() + 60_000 >= pending.expiresAt) throw new Error("Pending import expired before DB writes.");
      let createdCount = 0;
      let updatedCount = 0;
      let unchangedCount = 0;
      if (existingBaustelle) {
        // Serialize imports targeting one site, including document-array updates.
        await tx.$queryRaw`SELECT id FROM "Baustelle" WHERE id = ${baustelle.id} AND "companyProfileId" = ${company.id} FOR UPDATE`;
        const owned = await tx.baustelle.findFirst({ where: { id: baustelle.id, companyProfileId: company.id }, select: { id: true } });
        if (!owned) throw new Error("Import site no longer belongs to the authenticated company.");
      } else {
        await tx.baustelle.create({ data: { id: baustelle.id, companyProfileId: company.id,
          name: baustelleName, type: "CLIMBING", status: "active", documents: [] }, select: { id: true } });
      }
      const existingTrees = await tx.treeItem.findMany({
        where: { baustelleId: baustelle.id },
        select: { id: true, treeId: true, species: true, diameter: true, coordinates: true },
      });
      const existingTreeIndex = new Map<string, ExistingTreeItem>();
      existingTrees.forEach((tree) => rememberExistingTree(existingTreeIndex, tree));

      for (const item of treeItems) {
        const existingTree = findExistingTree(existingTreeIndex, item.treeId);

        if (!existingTree) {
          const createdTree = await tx.treeItem.create({
            data: { ...item, baustelleId: baustelle.id },
            select: { id: true, treeId: true, species: true, diameter: true, coordinates: true },
          });
          rememberExistingTree(existingTreeIndex, createdTree);
          createdCount += 1;
          continue;
        }

        const updateData: { species?: string; diameter?: number; coordinates?: ImportedTreeItem["coordinates"] } = {};
        if (existingTree.species !== item.species) updateData.species = item.species;
        if (existingTree.diameter !== item.diameter) updateData.diameter = item.diameter;
        if (item.coordinates !== Prisma.JsonNull && JSON.stringify(existingTree.coordinates) !== JSON.stringify(item.coordinates)) {
          updateData.coordinates = item.coordinates;
        }

        if (Object.keys(updateData).length > 0) {
          const updatedTree = await tx.treeItem.update({
            where: { id: existingTree.id },
            data: updateData,
            select: { id: true, treeId: true, species: true, diameter: true, coordinates: true },
          });
          rememberExistingTree(existingTreeIndex, updatedTree);
          updatedCount += 1;
        } else {
          unchangedCount += 1;
        }
      }
      const currentSite = await tx.baustelle.findFirst({ where: { id: baustelle.id, companyProfileId: company.id }, select: { documents: true } });
      if (!currentSite) throw new Error("Import site disappeared.");
      await tx.baustelle.update({ where: { id: baustelle.id },
        data: { documents: uniqueDocuments([...currentSite.documents, ...uploadedDocuments]) } });
      return { createdCount, updatedCount, unchangedCount };
    }, { timeout: 30_000 });
    committed = true;
    try {
      await finalizePendingImport(pending);
    } catch {
      // Durable journal remains recoverable; committed documents must never be removed.
      console.warn("Committed import journal requires reconciliation", pending.id);
    }

    try {
      revalidatePath("/app/baustellen");
      revalidatePath("/app/baustellen/import");
      revalidatePath("/workzone");
      revalidatePath(`/workzone/baustellen/${baustelle.id}`);
      notifyRealtimeUpdate("baustelle.updated", ["workzone-cards", "mission-control"]);

    } catch {
      console.warn("Committed import cache notification failed", pending.id);
    }
    return {
      ok: true,
      importedCount: createdCount + updatedCount,
      baustelleId: baustelle.id,
      message: t("admin.importSuccessSummary", lang)
        .replace("{created}", formatCount(createdCount, lang))
        .replace("{updated}", formatCount(updatedCount, lang))
        .replace("{unchanged}", formatCount(unchangedCount, lang)),
    };
  } catch (error) {
    if (pending && !committed) {
      try { await abortPendingImport(pending); }
      catch { console.warn("Failed import journal requires reconciliation", pending.id); }
    }
    const message = error instanceof Error ? error.message : t("admin.importFailed", lang);
    return { ok: false, message };
  }
}
