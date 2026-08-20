// Minimal CSV writer — quotes everything, escapes quotes, UTF-8 BOM so
// Excel opens ₹ and names correctly.
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) =>
    `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))];
  return '﻿' + lines.join('\r\n');
}

export function csvResponse(filename: string, csv: string) {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
