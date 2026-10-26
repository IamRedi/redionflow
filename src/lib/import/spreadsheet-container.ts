import { crc32, inflateRawSync } from "node:zlib";
import { XMLValidator } from "fast-xml-parser";

export const MAX_SPREADSHEET_BYTES = 20_000_000;
const MAX_EXPANDED_BYTES = 64_000_000;
const MAX_ENTRIES = 4096;
const refused = () => new Error("Malformed or oversized spreadsheet container.");

function validateExtraFields(bytes: Buffer, start: number, end: number) {
  for (let offset = start; offset < end;) {
    if (offset + 4 > end) throw refused();
    const tag = bytes.readUInt16LE(offset);
    const length = bytes.readUInt16LE(offset + 2);
    // SheetJS honors ZIP64 extras even without sentinel directory sizes.
    if (tag === 1 || offset + 4 + length > end) throw refused();
    offset += 4 + length;
  }
}

/** Validate ZIP directory and actual expansion before SheetJS allocates cells.
 * Only standard single-disk, unencrypted ZIP XLSX is accepted. No extraction,
 * filesystem writes, external links, macros or formula evaluation occurs.
 */
export function validateXlsxContainer(bytes: Buffer) {
  if (bytes.length > MAX_SPREADSHEET_BYTES || bytes.length < 22) throw refused();
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset--) {
    if (bytes.readUInt32LE(offset) === 0x06054b50 && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) { end = offset; break; }
  }
  if (end < 0) throw refused();
  // SheetJS locates the last EOCD signature, including one hidden in a comment.
  if (bytes.indexOf(Buffer.from([0x50,0x4b,5,6]), end + 4) !== -1) throw refused();
  const count = bytes.readUInt16LE(end + 10);
  const directorySize = bytes.readUInt32LE(end + 12);
  const directoryStart = bytes.readUInt32LE(end + 16);
  if (bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6) || bytes.readUInt16LE(end + 8) !== count ||
      count === 0 || count > MAX_ENTRIES || directoryStart + directorySize !== end) throw refused();
  const names = new Set<string>();
  const regions: Array<[number, number]> = [];
  let position = directoryStart;
  let expandedTotal = 0;
  for (let index = 0; index < count; index++) {
    if (position + 46 > end || bytes.readUInt32LE(position) !== 0x02014b50) throw refused();
    const flags = bytes.readUInt16LE(position + 8);
    const method = bytes.readUInt16LE(position + 10);
    const compressed = bytes.readUInt32LE(position + 20);
    const expanded = bytes.readUInt32LE(position + 24);
    const nameLength = bytes.readUInt16LE(position + 28);
    const extraLength = bytes.readUInt16LE(position + 30);
    const commentLength = bytes.readUInt16LE(position + 32);
    const local = bytes.readUInt32LE(position + 42);
    const next = position + 46 + nameLength + extraLength + commentLength;
    if (next > end || flags & 0x2041 || ![0,8].includes(method) || bytes.readUInt16LE(position + 34) ||
        compressed === 0xffffffff || expanded === 0xffffffff || local + 30 > directoryStart) throw refused();
    validateExtraFields(bytes, position + 46 + nameLength, position + 46 + nameLength + extraLength);
    const nameBytes = bytes.subarray(position + 46, position + 46 + nameLength);
    const name = nameBytes.toString("utf8");
    if (!name || name.includes("\\") || name.includes("\0") || name.startsWith("/") || name.split("/").includes("..") || names.has(name)) throw refused();
    names.add(name);
    expandedTotal += expanded;
    if (expandedTotal > MAX_EXPANDED_BYTES || bytes.readUInt32LE(local) !== 0x04034b50 ||
        bytes.readUInt16LE(local + 6) !== flags || bytes.readUInt16LE(local + 8) !== method) throw refused();
    const localNameLength = bytes.readUInt16LE(local + 26);
    const localExtraStart = local + 30 + localNameLength;
    const bodyStart = localExtraStart + bytes.readUInt16LE(local + 28);
    if (bodyStart + compressed > directoryStart || !bytes.subarray(local + 30, local + 30 + localNameLength).equals(nameBytes)) throw refused();
    validateExtraFields(bytes, localExtraStart, bodyStart);
    const crc = bytes.readUInt32LE(position + 16);
    // The downstream reader trusts local sizes when allocating/inflating. A
    // descriptor may leave these at zero, but may not override checked bounds.
    for (const [offset, expected] of [[14, crc], [18, compressed], [22, expanded]]) {
      const value = bytes.readUInt32LE(local + offset);
      if (value !== expected && !(flags & 8 && value === 0)) throw refused();
    }
    let regionEnd = bodyStart + compressed;
    if (flags & 8) {
      if (regionEnd + 12 > directoryStart) throw refused();
      if (bytes.readUInt32LE(regionEnd) === 0x08074b50) regionEnd += 4;
      if (regionEnd + 12 > directoryStart || bytes.readUInt32LE(regionEnd) !== crc ||
          bytes.readUInt32LE(regionEnd + 4) !== compressed || bytes.readUInt32LE(regionEnd + 8) !== expanded) throw refused();
      regionEnd += 12;
    }
    regions.push([local, regionEnd]);
    const body = bytes.subarray(bodyStart, bodyStart + compressed);
    try {
      const actual = method === 0 ? body : inflateRawSync(body, { maxOutputLength: Math.max(1, Math.min(expanded, MAX_EXPANDED_BYTES)) });
      if (actual.length !== expanded || crc32(actual) !== crc) throw refused();
      if (name.endsWith(".xml") || name.endsWith(".rels")) {
        // SheetJS tolerates incomplete XML and can return otherwise valid rows.
        // Validate every XML part before handing any workbook to that parser.
        const utf16le = (actual[0] === 0xff && actual[1] === 0xfe) || (actual[0] === 0x3c && actual[1] === 0);
        const utf16be = (actual[0] === 0xfe && actual[1] === 0xff) || (actual[0] === 0 && actual[1] === 0x3c);
        const text = new TextDecoder(utf16le ? "utf-16le" : utf16be ? "utf-16be" : "utf-8", { fatal: true }).decode(actual);
        if (XMLValidator.validate(text) !== true) throw refused();
      }
    } catch { throw refused(); }
    position = next;
  }
  regions.sort((a, b) => a[0] - b[0]);
  if (regions.some((region, index) => index > 0 && region[0] < regions[index - 1][1])) throw refused();
  if (position !== end || !names.has("[Content_Types].xml") || !names.has("xl/workbook.xml") ||
      ![...names].some(name => /^xl\/worksheets\/[^/]+\.xml$/.test(name))) throw refused();
}
