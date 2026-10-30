import { Icon } from '@bdc/ui';
import { ActionIcon, NumberInput } from '@mantine/core';
import { MoneyInput } from '~/components/MoneyInput';
import { formatPrice } from '~/lib/format';
import { type LineDraft, lineTotalP, optionText, totalP } from './logic';
import { VariantPicker } from './VariantPicker';

/** Editable lines of a draft PO (a locked PO shows `PoLinesReadOnly` instead). */
export function LinesEditor({
  supplierId,
  lines,
  onChange,
}: {
  supplierId: string;
  lines: LineDraft[];
  onChange: (lines: LineDraft[]) => void;
}) {
  const patch = (key: string, p: Partial<LineDraft>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...p } : l)));

  return (
    <>
      <div className="a-table-wrap">
        <table className="a-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty</th>
              <th>Unit cost</th>
              <th className="num">Line total</th>
              <th className="act" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="a-empty">
                    <h3>No lines yet</h3>
                    <p>Search a product below to add the first line.</p>
                  </div>
                </td>
              </tr>
            )}
            {lines.map((l) => (
              <tr key={l.key}>
                <td>
                  {l.title}
                  {optionText(l.options)}
                  <span className="sub">
                    {l.sku}
                    {l.hint ? ` · ${l.hint}` : ''}
                  </span>
                </td>
                <td>
                  <NumberInput
                    aria-label={`Quantity ${l.sku}`}
                    w={96}
                    min={1}
                    max={1_000_000}
                    allowDecimal={false}
                    allowNegative={false}
                    hideControls
                    value={l.qty ?? ''}
                    onChange={(v) => patch(l.key, { qty: typeof v === 'number' ? v : null })}
                  />
                </td>
                <td>
                  <MoneyInput
                    aria-label={`Unit cost ${l.sku}`}
                    w={120}
                    value={l.unitCostP}
                    onChange={(p) => patch(l.key, { unitCostP: p })}
                  />
                </td>
                <td className="num">{formatPrice(lineTotalP(l))}</td>
                <td className="act">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={`Remove ${l.sku}`}
                    onClick={() => onChange(lines.filter((x) => x.key !== l.key))}
                  >
                    <Icon name="trash" />
                  </ActionIcon>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ maxWidth: 480, marginTop: 12 }}>
        <VariantPicker
          supplierId={supplierId}
          taken={new Set(lines.map((l) => l.variantId))}
          onPick={(l) => onChange([...lines, l])}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 24,
          alignItems: 'baseline',
          padding: '8px 4px',
        }}
      >
        <span>Total (cost, VAT-inclusive)</span>
        <b style={{ fontSize: 17 }}>{formatPrice(totalP(lines))}</b>
      </div>
    </>
  );
}
