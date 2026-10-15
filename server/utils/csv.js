export function parseCsv(text) {
  const rows = [];
  let row = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  if (!rows.length) return [];
  const [headers, ...body] = rows;
  return body.map((cells, i) => {
    if (cells.length !== headers.length)
      throw new Error(
        `CSV row ${i + 2} has ${cells.length} cells, expected ${headers.length}`
      );
    return Object.fromEntries(
      headers.map((name, k) => [name.trim(), cells[k]])
    );
  });
}
