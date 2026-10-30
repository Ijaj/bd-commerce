import type { Mail } from '../../mail/mail.service';
import { formatPrice } from './po-format';

interface MailPo {
  poNo: string;
  expectedAt: string | null;
  notes: string | null;
  subtotalP: number;
  items: {
    sku: string;
    productTitleEn: string;
    options: { en: string }[];
    qtyOrdered: number;
    unitCostP: number;
    lineTotalP: number;
  }[];
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const label = (i: MailPo['items'][number]) =>
  [i.productTitleEn, ...i.options.map((o) => o.en)].join(' / ');

/** The purchase order as an email to the supplier (C75): plain text plus an HTML table. */
export function poMail(to: string, storeName: string, po: MailPo): Mail {
  const text = [
    `Purchase order ${po.poNo} from ${storeName}`,
    po.expectedAt ? `Expected by: ${po.expectedAt}` : null,
    '',
    ...po.items.map(
      (i) =>
        `${i.sku} | ${label(i)} | qty ${i.qtyOrdered} x ${formatPrice(i.unitCostP)} = ${formatPrice(i.lineTotalP)}`,
    ),
    '',
    `Total: ${formatPrice(po.subtotalP)}`,
    po.notes ? `\nNotes: ${po.notes}` : null,
  ]
    .filter((l) => l !== null)
    .join('\n');
  const rows = po.items
    .map(
      (i) =>
        `<tr><td>${esc(i.sku)}</td><td>${esc(label(i))}</td><td style="text-align:right">${i.qtyOrdered}</td>` +
        `<td style="text-align:right">${formatPrice(i.unitCostP)}</td><td style="text-align:right">${formatPrice(i.lineTotalP)}</td></tr>`,
    )
    .join('');
  const html =
    `<p>Purchase order <b>${esc(po.poNo)}</b> from ${esc(storeName)}.</p>` +
    (po.expectedAt ? `<p>Expected by: ${esc(po.expectedAt)}</p>` : '') +
    `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">` +
    `<tr><th>SKU</th><th>Item</th><th>Qty</th><th>Unit cost</th><th>Total</th></tr>${rows}` +
    `<tr><td colspan="4" style="text-align:right"><b>Total</b></td><td style="text-align:right"><b>${formatPrice(po.subtotalP)}</b></td></tr></table>` +
    (po.notes ? `<p>Notes: ${esc(po.notes)}</p>` : '');
  return { to, subject: `Purchase order ${po.poNo} from ${storeName}`, text, html };
}
