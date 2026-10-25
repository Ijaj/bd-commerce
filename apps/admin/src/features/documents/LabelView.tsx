import { formatPrice } from '@bdc/i18n';
import JsBarcode from 'jsbarcode';
import { useEffect, useRef } from 'react';
import { PageRule } from './PrintShell';
import type { Label } from './queries';

const CSS = `
@page { size: 4in 6in; margin: 0; }
.label { width: 4in; height: 6in; box-sizing: border-box; padding: 0.18in; border: 1px solid #999;
  margin: 12px auto; display: flex; flex-direction: column; gap: 6px; font-size: 12px; line-height: 1.35;
  overflow: hidden; background: #fff; }
.label .big { font-size: 15px; }
.label .cod { border: 2px solid #111; padding: 4px 8px; font-size: 16px; text-align: center; }
.label .row { display: flex; justify-content: space-between; gap: 8px; }
.label svg { width: 100%; height: 0.9in; }
@media print {
  .label { margin: 0; border: 0; page-break-after: always; break-after: page; }
  .label:last-child { page-break-after: auto; break-after: auto; }
}
`;

export function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        displayValue: true,
        height: 60,
        margin: 0,
      });
    } catch {
      // CODE128 takes any ASCII; a value outside it just leaves the text line below.
    }
  }, [value]);
  return <svg ref={ref} role="img" aria-label={`Barcode ${value}`} />;
}

/** One 4x6in shipping label. Phone, order and tracking numbers stay in English digits. */
export function LabelView({ label }: { label: Label }) {
  return (
    <div className="label">
      <div className="row">
        <span>{label.store.name}</span>
        <span>{label.store.phone}</span>
      </div>
      <div className="row">
        <span>Order {label.orderNo}</span>
        <span>{label.courier?.name ?? 'No courier'}</span>
      </div>
      <Barcode value={label.barcodeValue} />
      {label.consignmentId && <div>Tracking: {label.consignmentId}</div>}
      <div className="cod">
        {label.codAmountP > 0 ? `COD ${formatPrice(label.codAmountP, 'en')}` : 'PREPAID'}
      </div>
      <div>
        <div className="muted">Ship to</div>
        <div className="big">{label.to.name}</div>
        <div className="big">{label.to.phone}</div>
        <div>{label.to.address}</div>
        <div>{label.to.placeText}</div>
      </div>
      <div style={{ marginTop: 'auto' }}>
        <div>{label.itemsText}</div>
        {label.note && <div>Note: {label.note}</div>}
        <div className="row">
          <span>{label.shipmentNo}</span>
          {label.weightG ? <span>{label.weightG} g</span> : null}
        </div>
      </div>
    </div>
  );
}

export function LabelPageRule() {
  return <PageRule css={CSS} />;
}
