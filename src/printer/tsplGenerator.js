/**
 * Generates TSPL/TSPL2 commands for TSC Alpha-3RB (203 DPI, 72mm printable width).
 * Creates a clean bordered grid table for box labels and a scannable Code-128 barcode at the bottom.
 */

function sanitizeTSPL(val) {
  if (val == null) return '';
  return String(val)
    .replace(/["\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function generateBoxLabelTSPL({
  dnNumber = '',
  boxNumber = '',
  materials = [],
  copies = 1,
  fixedHeightMm = null,
}) {
  const cleanDN = sanitizeTSPL(dnNumber);
  const cleanBox = sanitizeTSPL(boxNumber);
  const validMaterials = materials.filter(m => m && (m.code || m.qty));

  // 203 DPI = 8 dots per mm. Printable width for 72mm is ~576 dots.
  const leftX = 20;
  const rightX = 556;
  const tableWidth = rightX - leftX; // 536 dots
  const colSplitX = 300; // vertical divider
  const rowHeight = 54; // dots (~6.75mm per row)

  const topY = 20;
  const totalRows = 3 + Math.max(1, validMaterials.length);
  const tableBottom = topY + totalRows * rowHeight;

  // Calculate overall label height in mm
  // Include room for barcode below table (height ~50 dots + text ~24 dots + margin)
  const barcodeY = tableBottom + 20;
  const totalContentDots = cleanDN ? (barcodeY + 75 + 20) : (tableBottom + 25);
  const calculatedHeightMm = Math.max(50, Math.ceil(totalContentDots / 8));
  const labelHeightMm = fixedHeightMm ? Math.max(fixedHeightMm, calculatedHeightMm) : calculatedHeightMm;

  const lines = [
    `SIZE 72 mm, ${labelHeightMm} mm`,
    `GAP 2 mm, 0 mm`,
    `DIRECTION 1`,
    `CLS`,
    // Outer table border (line thickness 3 dots)
    `BOX ${leftX}, ${topY}, ${rightX}, ${tableBottom}, 3`,
    // Vertical column divider
    `BAR ${colSplitX}, ${topY}, 3, ${tableBottom - topY}`,
  ];

  // Horizontal divider lines
  for (let i = 1; i < totalRows; i++) {
    const dividerY = topY + i * rowHeight;
    lines.push(`BAR ${leftX}, ${dividerY}, ${tableWidth}, 3`);
  }

  // Row 1: DN No
  const r1Y = topY + 14;
  lines.push(`TEXT ${leftX + 12}, ${r1Y}, "3", 0, 1, 1, "DN No"`);
  lines.push(`TEXT ${colSplitX + 14}, ${r1Y}, "3", 0, 1, 1, "${cleanDN || '-'}"`);

  // Row 2: Box No
  const r2Y = topY + rowHeight + 14;
  lines.push(`TEXT ${leftX + 12}, ${r2Y}, "3", 0, 1, 1, "Box No"`);
  lines.push(`TEXT ${colSplitX + 14}, ${r2Y}, "3", 0, 1, 1, "${cleanBox || '-'}"`);

  // Row 3: Material | Qty (Header)
  const r3Y = topY + rowHeight * 2 + 14;
  lines.push(`TEXT ${leftX + 12}, ${r3Y}, "3", 0, 1, 1, "Material"`);
  lines.push(`TEXT ${colSplitX + 14}, ${r3Y}, "3", 0, 1, 1, "Qty"`);

  // Row 4+: Materials list
  if (validMaterials.length === 0) {
    const rEmptyY = topY + rowHeight * 3 + 14;
    lines.push(`TEXT ${leftX + 12}, ${rEmptyY}, "2", 0, 1, 1, "No items"`);
    lines.push(`TEXT ${colSplitX + 14}, ${rEmptyY}, "2", 0, 1, 1, "-"`);
  } else {
    validMaterials.forEach((mat, idx) => {
      const itemY = topY + rowHeight * (3 + idx) + 14;
      const code = sanitizeTSPL(mat.code);
      const qty = sanitizeTSPL(mat.qty);
      lines.push(`TEXT ${leftX + 12}, ${itemY}, "3", 0, 1, 1, "${code || '-'}"`);
      lines.push(`TEXT ${colSplitX + 14}, ${itemY}, "3", 0, 1, 1, "${qty || '-'}"`);
    });
  }

  // Code-128 Barcode below table (centered)
  if (cleanDN) {
    // BARCODE X, Y, "128", height, human_readable(1=bottom), rotation, narrow, wide, "content"
    const barcodeStartX = Math.max(leftX + 30, Math.floor((576 - cleanDN.length * 20) / 2));
    lines.push(`BARCODE ${barcodeStartX}, ${barcodeY}, "128", 50, 1, 0, 2, 2, "${cleanDN}"`);
  }

  lines.push(`PRINT ${Math.max(1, parseInt(copies, 10) || 1)}, 1`);
  lines.push(''); // newline

  return lines.join('\r\n');
}
