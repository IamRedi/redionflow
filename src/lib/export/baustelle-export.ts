import { prisma } from "@/lib/db/prisma";
import { createStoredZip } from "@/lib/export/zip";
import { EXPORT_TEXT, normalizeExportLang } from "./baustelle/text";
import {
  actorLabel,
  asText,
  displayAdminName,
  displayWorkerName,
  formatDate,
  formatDateTime,
  htmlEscape,
  parseTreeMeta,
  sanitizeSegment,
  treeStatusLabel,
} from "./baustelle/format";
import { buildTreeKml, htmlDocument } from "./baustelle/documents";

export async function buildBaustelleExportZip(baustelleId: string, companyProfileId: string, lang?: string) {
  const exportLang = normalizeExportLang(lang);
  const text = EXPORT_TEXT[exportLang];
  const baustelle = await prisma.baustelle.findFirst({
    where: { id: baustelleId, companyProfileId },
    include: {
      treeItems: {
        orderBy: [{ status: "asc" }, { treeId: "asc" }],
        include: {
          completedByWorker: { select: { firstName: true, lastName: true } },
        },
      },
      manualTasks: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
          worker: { select: { id: true, firstName: true, lastName: true } },
          resolvedByUser: { select: { id: true, name: true, email: true } },
          resolvedByWorker: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      workLogs: {
        orderBy: { date: "asc" },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      inventoryMovements: {
        orderBy: { timestamp: "asc" },
        include: {
          worker: { select: { id: true, firstName: true, lastName: true } },
          actorAdmin: { select: { id: true, name: true, email: true } },
          treeItem: { select: { id: true, treeId: true } },
        },
      },
      coneMovements: {
        orderBy: { createdAt: "asc" },
        include: {
          fromMachine: { select: { id: true, name: true, nickname: true } },
          toMachine: { select: { id: true, name: true, nickname: true } },
          treeItem: { select: { id: true, treeId: true } },
          actorWorker: { select: { id: true, firstName: true, lastName: true } },
          actorAdmin: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!baustelle) return null;

  const archiveRoot = `${sanitizeSegment(baustelle.name)}-${sanitizeSegment(baustelle.id)}`;
  const normalizedTrees = baustelle.treeItems.map((tree) => {
    const meta = parseTreeMeta(tree.notes);
    return {
      treeId: tree.treeId,
      status: tree.status,
      statusLabel: treeStatusLabel(tree.status, text),
      species: tree.species ?? "-",
      diameter: tree.diameter ?? "-",
      action: meta.action || "-",
      note: meta.note || "-",
      branchCutsOver10: meta.branchCutsOver10,
      branchCutsOver20: meta.branchCutsOver20,
      branchCutsOver30: meta.branchCutsOver30,
      extraWork: meta.extraWork,
      completedByWorker: tree.completedByWorker ? displayWorkerName(tree.completedByWorker) : "",
    };
  });

  const reportReadme = [
    text.reportTitle,
    ``,
    text.readmeIntro,
    `- map/tree-markers.kml`,
    `- report/*`,
    ``,
    text.readmeFiles,
    `- README.txt`,
    `- uebersicht.html`,
    `- baumliste.html`,
    `- notizen.html`,
    `- tagesprotokoll.html`,
    `- bewegungen.html`,
    ``,
    `${text.generatedAt}: ${formatDateTime(new Date(), exportLang)}`,
  ].join("\n");

  const overviewHtml = htmlDocument(
    exportLang,
    `${text.reportTitle} - ${baustelle.name}`,
    text.overviewIntro(baustelle.name),
    `
      <h2>${htmlEscape(text.masterData)}</h2>
      <table>
        <tbody>
          <tr><th>${htmlEscape(text.name)}</th><td>${htmlEscape(baustelle.name)}</td></tr>
          <tr><th>ID</th><td>${htmlEscape(baustelle.id)}</td></tr>
          <tr><th>${htmlEscape(text.status)}</th><td>${htmlEscape(baustelle.status)}</td></tr>
          <tr><th>${htmlEscape(text.type)}</th><td>${htmlEscape(baustelle.type)}</td></tr>
          <tr><th>${htmlEscape(text.address)}</th><td>${htmlEscape(baustelle.address ?? "-")}</td></tr>
          <tr><th>${htmlEscape(text.description)}</th><td>${htmlEscape(baustelle.description ?? "-")}</td></tr>
          <tr><th>${htmlEscape(text.treesTotal)}</th><td>${baustelle.treeItems.length}</td></tr>
          <tr><th>${htmlEscape(text.done)}</th><td>${baustelle.treeItems.filter((tree) => tree.status === "done").length}</td></tr>
          <tr><th>${htmlEscape(text.blocked)}</th><td>${baustelle.treeItems.filter((tree) => tree.status === "blocked").length}</td></tr>
          <tr><th>${htmlEscape(text.open)}</th><td>${baustelle.treeItems.filter((tree) => tree.status === "todo").length}</td></tr>
        </tbody>
      </table>
    `,
  );

  const treeListHtml = htmlDocument(
    exportLang,
    `${text.treeList} - ${baustelle.name}`,
    text.treeListIntro,
    `
      <table>
        <thead>
          <tr>
            <th rowspan="2">${htmlEscape(text.tree)}</th>
            <th rowspan="2">${htmlEscape(text.status)}</th>
            <th rowspan="2">${htmlEscape(text.species)}</th>
            <th rowspan="2">${htmlEscape(text.diameter)}</th>
            <th rowspan="2" class="col-worker">${htmlEscape(text.completedBy)}</th>
            <th colspan="3">${htmlEscape(text.branches)} ⌀</th>
            <th rowspan="2" class="col-extra">${htmlEscape(text.extraWork)}</th>
            <th rowspan="2">${htmlEscape(text.action)}</th>
            <th rowspan="2">${htmlEscape(text.note)}</th>
          </tr>
          <tr>
            <th class="col-tight">&gt;10cm</th>
            <th class="col-tight">&gt;20cm</th>
            <th class="col-tight">&gt;30cm</th>
          </tr>
        </thead>
        <tbody>
          ${normalizedTrees
            .map((tree) => {
              const statusClass =
                tree.status === "done"
                  ? "status-erledigt"
                  : tree.status === "blocked"
                    ? "status-blockiert"
                    : "status-offen";
              return `
                <tr>
                  <td>${htmlEscape(tree.treeId)}</td>
                  <td><span class="status ${statusClass}">${htmlEscape(tree.statusLabel)}</span></td>
                  <td>${htmlEscape(tree.species)}</td>
                  <td>${htmlEscape(tree.diameter)}</td>
                  <td>${htmlEscape(tree.completedByWorker || "-")}</td>
                  <td class="col-tight">${htmlEscape(tree.branchCutsOver10 || "")}</td>
                  <td class="col-tight">${htmlEscape(tree.branchCutsOver20 || "")}</td>
                  <td class="col-tight">${htmlEscape(tree.branchCutsOver30 || "")}</td>
                  <td class="col-extra">${htmlEscape(tree.extraWork || "")}</td>
                  <td>${htmlEscape(tree.action)}</td>
                  <td>${htmlEscape(tree.note)}</td>
                </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    `,
  );

  const notesHtml = htmlDocument(
    exportLang,
    `${text.notes} - ${baustelle.name}`,
    text.notesIntro,
    `
      <table>
        <thead>
          <tr>
            <th>${htmlEscape(text.created)}</th>
            <th>${htmlEscape(text.description)}</th>
            <th>${htmlEscape(text.from)}</th>
            <th>${htmlEscape(text.worker)}</th>
            <th>${htmlEscape(text.done)}</th>
            <th>${htmlEscape(text.doneBy)}</th>
          </tr>
        </thead>
        <tbody>
          ${baustelle.manualTasks
            .map(
              (task) => `
                <tr>
                  <td>${htmlEscape(formatDateTime(task.createdAt, exportLang))}</td>
                  <td>${htmlEscape(task.description)}</td>
                  <td>${htmlEscape(displayAdminName(task.user))}</td>
                  <td>${htmlEscape(displayWorkerName(task.worker))}</td>
                  <td>${htmlEscape(formatDateTime(task.resolvedAt, exportLang))}</td>
                  <td>${htmlEscape(
                    displayAdminName(task.resolvedByUser) !== "-"
                      ? displayAdminName(task.resolvedByUser)
                      : displayWorkerName(task.resolvedByWorker),
                  )}</td>
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    `,
  );

  const logsHtml = htmlDocument(
    exportLang,
    `${text.dailyLog} - ${baustelle.name}`,
    text.dailyLogIntro,
    `
      <table>
        <thead>
          <tr>
            <th>${htmlEscape(text.date)}</th>
            <th>${htmlEscape(text.start)}</th>
            <th>${htmlEscape(text.end)}</th>
            <th>${htmlEscape(text.break)}</th>
            <th>Admin</th>
            <th>${htmlEscape(text.note)}</th>
          </tr>
        </thead>
        <tbody>
          ${baustelle.workLogs
            .map(
              (log) => `
                <tr>
                  <td>${htmlEscape(formatDate(log.date, exportLang))}</td>
                  <td>${htmlEscape(formatDateTime(log.startTime, exportLang))}</td>
                  <td>${htmlEscape(formatDateTime(log.endTime, exportLang))}</td>
                  <td>${log.breakMinutes} min</td>
                  <td>${htmlEscape(displayAdminName(log.user))}</td>
                  <td>${htmlEscape(log.notes ?? "-")}</td>
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    `,
  );

  const movementsHtml = htmlDocument(
    exportLang,
    `${text.movements} - ${baustelle.name}`,
    text.movementsIntro,
    `
      <h2>${htmlEscape(text.siteMaterial)}</h2>
      <table>
        <thead>
          <tr>
            <th>${htmlEscape(text.time)}</th>
            <th>${htmlEscape(text.type)}</th>
            <th>${htmlEscape(text.category)}</th>
            <th>${htmlEscape(text.quantity)}</th>
            <th>${htmlEscape(text.tree)}</th>
            <th>${htmlEscape(text.actor)}</th>
            <th>${htmlEscape(text.note)}</th>
          </tr>
        </thead>
        <tbody>
          ${baustelle.inventoryMovements
            .map(
              (row) => `
                <tr>
                  <td>${htmlEscape(formatDateTime(row.timestamp, exportLang))}</td>
                  <td>${htmlEscape(row.type)}</td>
                  <td>${htmlEscape(row.category)}</td>
                  <td>${row.quantity}</td>
                  <td>${htmlEscape(row.treeItem?.treeId ?? "-")}</td>
                  <td>${htmlEscape(actorLabel(row.actorRole, row.actorName, row.worker, row.actorAdmin))}</td>
                  <td>${htmlEscape(row.note ?? "-")}</td>
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>
      <h2>${htmlEscape(text.coneMovements)}</h2>
      <table>
        <thead>
          <tr>
            <th>${htmlEscape(text.time)}</th>
            <th>${htmlEscape(text.type)}</th>
            <th>${htmlEscape(text.quantity)}</th>
            <th>${htmlEscape(text.fromMachine)}</th>
            <th>${htmlEscape(text.toMachine)}</th>
            <th>${htmlEscape(text.tree)}</th>
            <th>${htmlEscape(text.actor)}</th>
            <th>${htmlEscape(text.note)}</th>
          </tr>
        </thead>
        <tbody>
          ${baustelle.coneMovements
            .map(
              (row) => `
                <tr>
                  <td>${htmlEscape(formatDateTime(row.createdAt, exportLang))}</td>
                  <td>${htmlEscape(row.type)}</td>
                  <td>${row.quantity}</td>
                  <td>${htmlEscape(row.fromMachine?.nickname || row.fromMachine?.name || "-")}</td>
                  <td>${htmlEscape(row.toMachine?.nickname || row.toMachine?.name || "-")}</td>
                  <td>${htmlEscape(row.treeItem?.treeId ?? "-")}</td>
                  <td>${htmlEscape(actorLabel(row.actorRole, row.actorName, row.actorWorker, row.actorAdmin))}</td>
                  <td>${htmlEscape(row.note ?? "-")}</td>
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    `,
  );

  const entries = [
    {
      name: `${archiveRoot}/report/README.txt`,
      data: asText(reportReadme),
    },
    {
      name: `${archiveRoot}/report/uebersicht.html`,
      data: asText(overviewHtml),
    },
    {
      name: `${archiveRoot}/report/baumliste.html`,
      data: asText(treeListHtml),
    },
    {
      name: `${archiveRoot}/report/notizen.html`,
      data: asText(notesHtml),
    },
    {
      name: `${archiveRoot}/report/tagesprotokoll.html`,
      data: asText(logsHtml),
    },
    {
      name: `${archiveRoot}/report/bewegungen.html`,
      data: asText(movementsHtml),
    },
    {
      name: `${archiveRoot}/map/tree-markers.kml`,
      data: asText(
        buildTreeKml({
          name: baustelle.name,
          address: baustelle.address,
          coordinates: baustelle.coordinates,
          treeItems: baustelle.treeItems,
        }, text),
      ),
    },
  ];

  const archiveName = `${archiveRoot}-export.zip`;
  return {
    archiveName,
    buffer: createStoredZip(entries),
  };
}
