import * as XLSX from 'xlsx';

/**
 * Creates an Excel workbook and File/Blob object from records.
 * DN No and Docket No are stored as TEXT to prevent Excel from
 * converting long numbers to scientific notation.
 */
export function createExcelFile(records) {
  if (!records || records.length === 0) {
    throw new Error('No records to export.');
  }

  const wb = XLSX.utils.book_new();

  // Build data rows — include ALL records (show empty string for missing values)
  const header = ['Sr No', 'DN No', 'Docket No', 'No of Boxes', 'Weight', 'Transporter Name'];
  const rows = records.map((r, idx) => [
    idx + 1,
    r.dnNumber || '',
    r.docketNumber || '',
    r.boxes || '',
    r.weight || '',
    r.transporter || '',
  ]);

  // Create worksheet from array of arrays
  const wsData = [header, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData, { raw: false });

  // Force text type for data columns (cols B through F) to prevent numeric/scientific formatting glitches
  const rowCount = rows.length;
  for (let row = 1; row <= rowCount; row++) {
    for (let c = 1; c <= 5; c++) {
      const addr = XLSX.utils.encode_cell({ r: row, c });
      if (ws[addr] && ws[addr].v !== '') {
        ws[addr].t = 's';
        ws[addr].z = '@';
      }
    }
  }

  // Column widths
  ws['!cols'] = [
    { wch: 8 },   // Sr No
    { wch: 18 },  // DN No
    { wch: 22 },  // Docket No
    { wch: 14 },  // No of Boxes
    { wch: 14 },  // Weight
    { wch: 26 },  // Transporter Name
  ];

  // Freeze top row
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };

  XLSX.utils.book_append_sheet(wb, ws, 'Scanned Records');

  // Filename with timestamp
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const filename = `Invoice_Docket_Scan_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.xlsx`;

  // Generate binary buffer & File / Blob
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const blob = new Blob([wbout], { type: mimeType });
  const file = new File([blob], filename, { type: mimeType });

  return { wb, filename, blob, file };
}

/**
 * Export records to a .xlsx file and trigger browser download.
 * Returns { filename, file, blob, wb }.
 */
export function exportToExcel(records) {
  const fileData = createExcelFile(records);
  XLSX.writeFile(fileData.wb, fileData.filename);
  return fileData;
}

/**
 * Shares an Excel file using the native Web Share API if supported.
 * Falls back to triggering a download if file sharing is unavailable.
 */
export async function shareExcelFile(fileData) {
  if (!fileData || !fileData.file) {
    throw new Error('No file available to share.');
  }

  const { file, filename } = fileData;

  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: filename,
        text: 'Invoice & Docket Scanned Records',
      });
      return { shared: true };
    } catch (err) {
      if (err.name === 'AbortError') {
        // User dismissed the share sheet
        return { shared: false, cancelled: true };
      }
      throw err;
    }
  }

  // Fallback if sharing files is not supported (e.g. desktop Chrome)
  const url = URL.createObjectURL(fileData.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { shared: false, downloaded: true };
}

/**
 * Creates a CSV Blob from records (useful as an alternative share format)
 */
export function createCsvBlob(records) {
  const header = 'Sr No,DN No,Docket No,No of Boxes,Weight,Transporter Name\n';
  const rows = (records || []).map((r, i) =>
    `${i + 1},"${r.dnNumber || ''}","${r.docketNumber || ''}","${r.boxes || ''}","${r.weight || ''}","${r.transporter || ''}"`
  ).join('\n');
  return new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
}

/**
 * Formats records cleanly for sharing via WhatsApp message
 */
export function formatRecordsForWhatsApp(records) {
  if (!records || records.length === 0) return 'No records to share.';
  const count = records.length;
  const complete = records.filter(r => r.status === 'COMPLETE').length;
  const header = `📋 *Invoice & Docket Scan Report*\nTotal Records: ${count} (${complete} Complete)\n------------------------------\n`;
  const lines = records.map((r, i) => {
    const dn = r.dnNumber || '(missing)';
    const docket = r.docketNumber || '(missing)';
    const details = [
      r.boxes ? `Boxes: ${r.boxes}` : '',
      r.weight ? `Wt: ${r.weight}` : '',
      r.transporter ? `Transporter: ${r.transporter}` : '',
    ].filter(Boolean).join(' | ');

    return `${i + 1}. DN: ${dn}  |  Docket: ${docket}${details ? `\n   ↳ ${details}` : ''}`;
  });
  return `${header}${lines.join('\n')}\n------------------------------\nSent from Invoice & Docket Scanner`;
}

/**
 * Formats records for copy-pasting (tab-delimited for Excel/Sheets)
 */
export function formatRecordsForClipboard(records) {
  if (!records || records.length === 0) return '';
  const header = 'Sr No\tDN No\tDocket No\tNo of Boxes\tWeight\tTransporter Name\n';
  const rows = records.map((r, i) =>
    `${i + 1}\t${r.dnNumber || ''}\t${r.docketNumber || ''}\t${r.boxes || ''}\t${r.weight || ''}\t${r.transporter || ''}`
  ).join('\n');
  return `${header}${rows}`;
}


