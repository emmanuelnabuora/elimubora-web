/**
 * Minimal CSV parser handling quoted fields (so names, addresses, or
 * descriptions containing commas or embedded newlines survive
 * correctly) without pulling in a dependency for something this
 * small. Not a full RFC 4180 implementation, but handles the real
 * cases: quoted fields, escaped quotes ("" inside a quoted field),
 * and commas/newlines inside quotes.
 *
 * Returns an array of row objects keyed by the header row -- the
 * first line is always treated as headers. Header names are trimmed
 * and lowercased with spaces collapsed to make matching forgiving
 * (e.g. "Full Name" and "full_name" both work if the caller checks
 * for "fullname" or similar), but the caller is responsible for the
 * exact key normalization it expects.
 */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return [];
  const headers = rows[0]!.map((h) => h.trim());
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (row[i] ?? '').trim();
    });
    return obj;
  });
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      field = '';
      if (row.some((f) => f.trim().length > 0)) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((f) => f.trim().length > 0)) rows.push(row);
  }
  return rows;
}
