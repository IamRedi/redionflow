import "dotenv/config";
import { readFleetSpreadsheet } from "./lib/fleet-parser";

import { getOrCreateDefaultCompany } from "../src/lib/db/company";
import { prisma } from "../src/lib/db/prisma";

type FleetRow = Record<string, string | number | null | undefined>;

function cell(row: FleetRow, name: string) {
  const value = row[name];
  return value == null ? "" : String(value).trim();
}

function normalizePlate(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseMonthYear(value: string) {
  const match = value.match(/^(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const rawYear = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  return new Date(year, month, 0);
}

function parseYearFromDate(value: string) {
  const match = value.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (!match) return null;
  const rawYear = Number(match[3]);
  return rawYear < 100 ? (rawYear >= 80 ? 1900 + rawYear : 2000 + rawYear) : rawYear;
}

function mapCategory(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("hubsteiger")) return "AWP" as const;
  if (lower.includes("lkw") || lower.includes("transporter") || lower.includes("anhänger")) return "TRUCK" as const;
  if (lower.includes("häcksler") || lower.includes("haecksler")) return "CHIPPER" as const;
  if (lower.includes("säge") || lower.includes("saege")) return "CHAINSAW" as const;
  return "OTHER" as const;
}

function compactNotes(parts: Array<[string, string]>) {
  return parts
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

async function uniqueMachineName(companyProfileId: string, desiredName: string, plate: string) {
  const existing = await prisma.machine.findFirst({ where: { companyProfileId, name: desiredName } });
  if (!existing) return desiredName;
  if (plate && plate.toLowerCase() !== "ohne") return `${desiredName} (${plate})`;
  return `${desiredName} (${Date.now()})`;
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npx tsx scripts/import-fleet-from-xlsx.ts <xlsx-file>");

  const rows = readFleetSpreadsheet(file);
  const company = await getOrCreateDefaultCompany();

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const categoryIntern = cell(row, "Kategorie intern");
    const model = cell(row, "Marke / Handels-\r\nbezeichnung / Modell");
    const vin = cell(row, "Fahrzeug-Ident-Nr.");
    const plate = normalizePlate(cell(row, "Kennz."));
    const nickname = cell(row, "Interne Bezeichnung") || plate || model;
    const hu = cell(row, "HU");
    const huStatus = cell(row, "HU !!");
    const sp = cell(row, "SP");
    const spStatus = cell(row, "SP !!");
    const uvv = cell(row, "UVV");
    const uvvStatus = cell(row, "UVV !!");
    const firstRegistration = cell(row, "Erstzul.");
    const purchaseDate = cell(row, "Kaufdatum");
    const remark = cell(row, "Bemerkung");

    if (!nickname && !model && !plate) {
      skipped += 1;
      continue;
    }

    const notes = compactNotes([
      ["VIN", vin],
      ["HU", hu],
      ["HU Status", huStatus],
      ["SP", sp],
      ["SP Status", spStatus],
      ["UVV", uvv],
      ["UVV Status", uvvStatus],
      ["Erstzulassung", firstRegistration],
      ["Kaufdatum", purchaseDate],
      ["Bemerkung", remark],
    ]);

    const existingByPlate =
      plate && plate.toLowerCase() !== "ohne"
        ? await prisma.machine.findFirst({ where: { companyProfileId: company.id, targe: plate } })
        : null;
    const existing =
      existingByPlate ??
      (await prisma.machine.findFirst({
        where: { companyProfileId: company.id, name: nickname },
      }));

    const data = {
      name: existing ? nickname : await uniqueMachineName(company.id, nickname, plate),
      nickname,
      model: model || null,
      targe: plate || null,
      vitiProdhimit: parseYearFromDate(firstRegistration),
      vitiBlerjes: parseYearFromDate(purchaseDate),
      tuvDate: parseMonthYear(hu),
      auDate: null,
      huStatus: huStatus || null,
      spDate: parseMonthYear(sp),
      spStatus: spStatus || null,
      uvvDate: parseMonthYear(uvv),
      uvvStatus: uvvStatus || null,
      funksioni: categoryIntern || null,
      patentaEnevojshme: null,
      category: mapCategory(categoryIntern),
      notes: notes || null,
      isActive: true,
    };

    if (existing) {
      await prisma.machine.update({
        where: { id: existing.id },
        data,
      });
      updated += 1;
    } else {
      await prisma.machine.create({
        data: {
          companyProfileId: company.id,
          hourlyRateCents: 0,
          dayRateCents: null,
          ...data,
        },
      });
      created += 1;
    }
  }

  console.log(`Fleet import done: ${created} created, ${updated} updated, ${skipped} skipped.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
