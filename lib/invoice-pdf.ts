import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';
import type { Order, Settings } from './types';
import { dateLong, paymentLineFor } from './invoice-shared';

// =========================================================
// Real PDF via pdfmake (server-side) — the "Download" path.
// Mirrors the server's minimal HTML invoice one-to-one:
// logo, number, who, what, total. Nothing else.
// =========================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

const INK = '#101410';
const MUTED = '#6b716a';
const LINE = '#ececea';
const ACCENT = '#6de325';

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

let engine: any | null = null;

// pdfmake 0.3 exposes a singleton: setFonts(...) once, then createPdf(doc).
// It resolves fonts by PATH (not Buffer), so we extract the Roboto TTFs
// bundled in its vfs to a local cache directory once per boot.
function getEngine() {
  if (engine) return engine;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfmake = require('pdfmake');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const vfs = require('pdfmake/build/vfs_fonts.js');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fsSync = require('fs') as typeof import('fs');

  const fontDir = path.join(process.cwd(), '.fonts');
  fsSync.mkdirSync(fontDir, { recursive: true });
  const fontPath = (name: string) => {
    const file = path.join(fontDir, name);
    if (!fsSync.existsSync(file)) fsSync.writeFileSync(file, Buffer.from(vfs[name], 'base64'));
    return file;
  };

  pdfmake.setFonts({
    Roboto: {
      normal: fontPath('Roboto-Regular.ttf'),
      bold: fontPath('Roboto-Medium.ttf'),
      italics: fontPath('Roboto-Italic.ttf'),
      bolditalics: fontPath('Roboto-MediumItalic.ttf'),
    },
  });
  // Only our own font cache and public assets are ever read.
  pdfmake.setLocalAccessPolicy((p: string) => p.startsWith(fontDir) || p.startsWith(path.join(process.cwd(), 'public')));
  engine = pdfmake;
  return engine;
}

export async function renderInvoicePdf(order: Order, settings: Settings): Promise<Buffer> {
  const logo = await fs.readFile(path.join(process.cwd(), 'public', '10x-logo-black.png'));

  const itemRows = order.items.map((item) => [
    {
      stack: [
        { text: item.name, bold: true },
        { text: `${item.quantity} × ${rupees(item.price)}`, fontSize: 8.5, color: MUTED, margin: [0, 1, 0, 0] },
      ],
    },
    { text: rupees(item.price * item.quantity), alignment: 'right', bold: true },
  ]);

  const summaryRows: [string, string][] = [];
  if (order.discount > 0 || order.shipping > 0) summaryRows.push(['Subtotal', rupees(order.subtotal)]);
  if (order.discount > 0) summaryRows.push([`Discount${order.couponCode ? ` · ${order.couponCode}` : ''}`, `−${rupees(order.discount)}`]);
  summaryRows.push(['Delivery', order.shipping === 0 ? 'Free' : rupees(order.shipping)]);

  const doc = {
    pageSize: 'A4',
    pageMargins: [48, 56, 48, 56],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: INK, lineHeight: 1.3 },
    info: { title: `${order.invoiceNo ?? order.reference} — ${settings.store.name} invoice` },
    // Brand bars, edge to edge.
    background: () => ({
      canvas: [
        { type: 'rect', x: 0, y: 0, w: 595.28, h: 6, color: ACCENT },
        { type: 'rect', x: 0, y: 841.89 - 6, w: 595.28, h: 6, color: ACCENT },
      ],
    }),
    content: [
      {
        columns: [
          { width: '*', stack: [{ image: 'logo', width: 72 }] },
          {
            width: 'auto',
            stack: [
              { text: 'INVOICE', fontSize: 8, bold: true, characterSpacing: 2, color: MUTED, alignment: 'right' },
              { text: order.invoiceNo ?? order.reference, fontSize: 13, bold: true, alignment: 'right', margin: [0, 1, 0, 0] },
              { text: `${dateLong(order.placedAt)} · Order ${order.reference}`, fontSize: 9, color: MUTED, alignment: 'right', margin: [0, 3, 0, 0] },
            ],
          },
        ],
        columnGap: 24,
      },

      // Who it went to
      {
        stack: [
          { text: order.customerName, bold: true },
          { text: `${order.address.house}, ${order.address.street}`, color: MUTED, fontSize: 9.5 },
          { text: `${order.address.city}, ${order.address.state} ${order.address.pincode}`, color: MUTED, fontSize: 9.5 },
        ],
        margin: [0, 26, 0, 0],
      },

      // Items
      {
        margin: [0, 20, 0, 0],
        table: { widths: ['*', 'auto'], body: itemRows },
        layout: {
          hLineWidth: (i: number) => (i === 0 ? 1.5 : 0.5),
          hLineColor: (i: number) => (i === 0 ? INK : LINE),
          vLineWidth: () => 0,
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: () => 8,
          paddingBottom: () => 8,
        },
      },

      // Summary
      {
        table: {
          widths: ['*', 'auto'],
          body: summaryRows.map(([l, v]) => [
            { text: l, color: MUTED },
            { text: v, alignment: 'right', color: l.startsWith('Discount') ? '#3f8f0d' : INK, bold: l.startsWith('Discount') },
          ]),
        },
        layout: { defaultBorder: false, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 4, paddingBottom: () => 4 },
      },

      // Total
      {
        margin: [0, 6, 0, 0],
        table: {
          widths: ['*', 'auto'],
          body: [[
            { text: 'TOTAL', bold: true, fontSize: 10, characterSpacing: 1.5, margin: [0, 5, 0, 0] },
            { text: rupees(order.total), bold: true, fontSize: 15, alignment: 'right', fillColor: ACCENT, color: INK },
          ]],
        },
        layout: {
          defaultBorder: false,
          hLineWidth: (i: number) => (i === 0 ? 1.5 : 0),
          hLineColor: () => INK,
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: () => 8,
          paddingBottom: () => 2,
        },
      },
      { text: paymentLineFor(order), fontSize: 9, color: MUTED, alignment: 'right', margin: [0, 6, 0, 0] },
    ],
    footer: {
      margin: [48, 10, 48, 0],
      columns: [
        { text: `${settings.store.name} · ${settings.store.supportEmail}`, fontSize: 8.5, color: MUTED },
        { text: 'Computer-generated · no signature required', alignment: 'right', fontSize: 8.5, color: MUTED },
      ],
    },
    images: { logo: `data:image/png;base64,${logo.toString('base64')}` },
  };

  const output = getEngine().createPdf(doc);
  const buffer: Buffer = await output.getBuffer();
  return buffer;
}
