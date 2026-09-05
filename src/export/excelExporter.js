import * as XLSX from 'xlsx';

/**
 * Export records to a .xlsx file and trigger browser download.
 * DN No and Docket No are stored as TEXT to prevent Excel from
 * converting long numbers to scientific notation.
 */
export function exportToExcel(records) {
  if (!records || records.length === 0) {
    throw new Error('No records to export.');
  }

  const wb = XLSX.utils.book_new();

  // Build data rows — include ALL records (show dashes for missing values)
  const header = ['Sr No', 'DN No', 'Docket No'];
  const rows = records.map((r, idx) => [
    idx + 1,
    r.dnNumber || '',
    r.docketNumber || '',
  ]);

  // Create worksheet from array of arrays
  const wsData = [header, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData, { raw: false });

  // Force DN No (col B) and Docket No (col C) cells to TEXT type
  const rowCount = rows.length;
  for (let row = 1; row <= rowCount; row++) {
    const dnAddr = XLSX.utils.encode_cell({ r: row, c: 1 });
    const docketAddr = XLSX.utils.encode_cell({ r: row, c: 2 });
    if (ws[dnAddr] && ws[dnAddr].v !== '') {
      ws[dnAddr].t = 's';
      ws[dnAddr].z = '@';
    }
    if (ws[docketAddr] && ws[docketAddr].v !== '') {
      ws[docketAddr].t = 's';
      ws[docketAddr].z = '@';
    }
  }

  // Column widths
  ws['!cols'] = [
    { wch: 8 },   // Sr No
    { wch: 16 },  // DN No
    { wch: 22 },  // Docket No
  ];

  // Freeze top row
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };

  XLSX.utils.book_append_sheet(wb, ws, 'Scanned Records');

  // Filename with timestamp
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const filename = `Invoice_Docket_Scan_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.xlsx`;

  XLSX.writeFile(wb, filename);
  return filename;
}
