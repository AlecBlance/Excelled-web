import { fail, LIMITS, WorkbookError } from "./workbook-file";

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Validate the directory before decompression. ZIP64, encryption, multi-disk ZIPs,
// overlapping records and ambiguous local/directory names are deliberately refused.
export function preflightArchive(data: Uint8Array) {
  try {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const u16 = (at: number) => view.getUint16(at, true);
    const u32 = (at: number) => view.getUint32(at, true);
    let end = -1;
    for (let at = data.length - 22; at >= Math.max(0, data.length - 65557); at--) {
      if (u32(at) === 0x06054b50 && at + 22 + u16(at + 20) === data.length) {
        end = at;
        break;
      }
    }
    if (end < 0 || u16(end + 4) || u16(end + 6) || u16(end + 8) !== u16(end + 10)) throw new Error();
    const count = u16(end + 10);
    if (count > LIMITS.entries) fail("archive-limit", "This workbook contains too many package parts (2,000 maximum). Try a smaller copy.");
    const directorySize = u32(end + 12);
    const directoryStart = u32(end + 16);
    if (!count || directoryStart + directorySize !== end) throw new Error();
    const entries = new Map<string, { size: number; crc: number }>();
    const ranges: { start: number; end: number }[] = [];
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let cursor = directoryStart;
    let expanded = 0;
    for (let index = 0; index < count; index++) {
      if (u32(cursor) !== 0x02014b50) throw new Error();
      const flags = u16(cursor + 8);
      const method = u16(cursor + 10);
      const compressed = u32(cursor + 20);
      const size = u32(cursor + 24);
      const nameSize = u16(cursor + 28);
      const extraSize = u16(cursor + 30);
      const commentSize = u16(cursor + 32);
      const local = u32(cursor + 42);
      if ((flags & 0x41) || ![0, 8].includes(method) || u16(cursor + 34) ||
        compressed === 0xffffffff || size === 0xffffffff || local === 0xffffffff) throw new Error();
      const nameBytes = data.subarray(cursor + 46, cursor + 46 + nameSize);
      const name = decoder.decode(nameBytes);
      if (!name || entries.has(name)) throw new Error();
      expanded += size;
      if (size > LIMITS.entry || expanded > LIMITS.expanded) {
        fail("archive-limit", "This workbook expands beyond the safety limits. Try a smaller workbook.");
      }
      if (u32(local) !== 0x04034b50 || u16(local + 6) !== flags || u16(local + 8) !== method || u16(local + 26) !== nameSize) throw new Error();
      const localName = data.subarray(local + 30, local + 30 + nameSize);
      if (localName.length !== nameBytes.length || !localName.every((byte, i) => byte === nameBytes[i])) throw new Error();
      const start = local + 30 + nameSize + u16(local + 28);
      if (start + compressed > directoryStart) throw new Error();
      ranges.push({ start: local, end: start + compressed });
      entries.set(name, { size, crc: u32(cursor + 16) });
      cursor += 46 + nameSize + extraSize + commentSize;
      if (cursor > end) throw new Error();
    }
    if (cursor !== end) throw new Error();
    ranges.sort((a, b) => a.start - b.start);
    if (ranges[0].start !== 0 || ranges.some((range, index) => index && range.start < ranges[index - 1].end)) throw new Error();
    return entries;
  } catch (error) {
    if (error instanceof WorkbookError) throw error;
    fail("invalid-archive", "This Excel package is damaged, encrypted, or uses unsupported ZIP features. Save a fresh copy in Excel and try again.");
  }
}
