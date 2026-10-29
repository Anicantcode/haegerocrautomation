import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

/**
 * Code-128 SVG Barcode Generator for label previews and browser printing.
 */
export function BarcodeSvg({ value, height = 46, fontSize = 13 }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const clean = String(value || '').trim();
    if (!clean) return;

    try {
      JsBarcode(svgRef.current, clean, {
        format: 'CODE128',
        width: 1.8,
        height: height,
        displayValue: true,
        fontSize: fontSize,
        font: 'Arial, sans-serif',
        fontOptions: 'bold',
        textMargin: 2,
        margin: 4,
        background: '#ffffff',
        lineColor: '#000000',
      });
    } catch (err) {
      console.warn('Could not generate Code-128 barcode:', err);
    }
  }, [value, height, fontSize]);

  if (!value) return null;

  return (
    <div className="flex justify-center items-center w-full py-1">
      <svg ref={svgRef} className="max-w-full" />
    </div>
  );
}
