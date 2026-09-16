export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };

  const pushRow = () => {
    pushField();
    if (row.some((value) => value !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\n') {
      pushRow();
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (quoted) throw new Error('Unclosed quote in CSV.');
  if (field.length || row.length) pushRow();
  if (!rows.length) return [];

  const header = rows[0];
  return rows.slice(1).map((values) =>
    Object.fromEntries(header.map((key, index) => [key, values[index] ?? ''])),
  );
}
