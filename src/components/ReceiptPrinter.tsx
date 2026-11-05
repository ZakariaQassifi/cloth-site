import React, { useEffect, useState } from 'react';
import type { Order } from '../data/order';
import { brandConfig } from '../config/brand';
import { useTranslation } from '../i18n/useI18n';
import { useColorLabel, usePaymentLabel } from '../i18n/hooks';
import { DownloadTicketButton } from './DownloadTicketButton';
import './ReceiptPrinter.css';

/**
 * Deterministic pseudo-random generator so the barcode / QR pattern on the
 * ticket is stable for a given order id (no re-render drift between the
 * screen and a later PDF export).
 */
function hashCode(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface BarcodeStripe {
  x: number;
  width: number;
}

function buildBarcode(value: string, targetWidth = 240): BarcodeStripe[] {
  const rand = mulberry32(hashCode(value));
  const stripes: BarcodeStripe[] = [];
  let x = 0;
  while (x < targetWidth) {
    const width = 1 + Math.floor(rand() * 3);
    stripes.push({ x, width });
    x += width + 1 + Math.floor(rand() * 2);
  }
  return stripes;
}

/** Candidate cells as a Set of "col,row" keys for a QR-looking 21×21 grid. */
function buildQrModules(value: string, size = 21): boolean[][] {
  const rand = mulberry32(hashCode(value));
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const inFinder = (c: number, r: number): boolean =>
    (c < 7 && r < 7) || (c >= size - 7 && r < 7) || (c < 7 && r >= size - 7);
  const inTiming = (c: number, r: number): boolean => c === 6 || r === 6;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (inFinder(c, r)) continue;
      if (inTiming(c, r)) {
        grid[r][c] = (c + r) % 2 === 0;
        continue;
      }
      grid[r][c] = rand() > 0.5;
    }
  }
  return grid;
}

function FinderPattern({ x, y }: { x: number; y: number }): React.ReactElement {
  const cells: Array<[number, number]> = [];
  for (let r = 0; r < 7; r += 1) {
    for (let c = 0; c < 7; c += 1) {
      const edge = r === 0 || r === 6 || c === 0 || c === 6;
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      if (edge || core) cells.push([y + r, x + c]);
    }
  }
  return (
    <>
      {cells.map(([r, c]) => (
        <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} />
      ))}
    </>
  );
}

const Barcode: React.FC<{ value: string }> = ({ value }) => (
  <svg
    className="thermal-receipt__barcode"
    viewBox="0 0 240 46"
    role="img"
    aria-label={value}
    preserveAspectRatio="xMidYMid meet"
  >
    {buildBarcode(value).map(({ x, width }) => (
      <rect key={x} x={x} y={0} width={width} height={40} fill="#161513" />
    ))}
  </svg>
);

const QrCode: React.FC<{ value: string }> = ({ value }) => {
  const grid = buildQrModules(value);
  return (
    <svg
      className="thermal-receipt__qr"
      viewBox="0 0 21 21"
      role="img"
      aria-label={value}
      preserveAspectRatio="xMidYMid meet"
    >
      <g fill="#161513">
        {grid.flatMap((row, r) =>
          row
            .map((on, c) => (on ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} /> : null))
            .filter(Boolean)
        )}
        <FinderPattern x={0} y={0} />
        <FinderPattern x={14} y={0} />
        <FinderPattern x={0} y={14} />
      </g>
    </svg>
  );
};

export interface ReceiptPrinterProps {
  order: Order;
}

/**
 * Thermal-receipt station: a POS printer head from which the order ticket
 * slides out (paper feeds from the slit and drops onto the page).
 */
export const ReceiptPrinter: React.FC<ReceiptPrinterProps> = ({ order }) => {
  const { t, formatDate, formatMoney } = useTranslation();
  const colorLabel = useColorLabel();
  const paymentLabel = usePaymentLabel();
  const [printed, setPrinted] = useState(false);
  const [ticketNode, setTicketNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setPrinted(true), 2900);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="receipt-printer">
      <div className="receipt-printer__head">
        <div className="receipt-printer__hud">
          <span className="receipt-printer__brandmark">KINETIC POS</span>
          <span
            className={`receipt-printer__led${printed ? ' receipt-printer__led--ready' : ''}`}
            aria-hidden="true"
          />
          <span className="receipt-printer__status" role="status" aria-live="polite">
            {printed ? t('confirm.printDone') : t('confirm.printStatus')}
          </span>
        </div>
        <div className="receipt-printer__slot" />
      </div>

      <div className="receipt-printer__mouth">
        <article ref={setTicketNode} className="thermal-receipt">
          <div className="thermal-receipt__shiver">
            <header className="thermal-receipt__header">
              <p className="thermal-receipt__store">{brandConfig.name}</p>
              <p className="thermal-receipt__muted thermal-receipt__center">
                {brandConfig.address}
              </p>
              <p className="thermal-receipt__muted thermal-receipt__center">
                {brandConfig.supportPhone}
              </p>
            </header>

            <div className="thermal-receipt__cut" />

            <section className="thermal-receipt__block">
              <div className="thermal-receipt__row">
                <span className="thermal-receipt__muted">{t('confirm.orderNumber')}</span>
                <span className="thermal-receipt__strong">{order.orderNumber}</span>
              </div>
              <div className="thermal-receipt__row">
                <span className="thermal-receipt__muted">{t('confirm.date')}</span>
                <span>{formatDate(order.date)}</span>
              </div>
              <div className="thermal-receipt__row">
                <span className="thermal-receipt__muted">{t('confirm.paymentMethod')}</span>
                <span>{paymentLabel(order.paymentMethod)}</span>
              </div>
            </section>

            <div className="thermal-receipt__cut" />

            <section className="thermal-receipt__block">
              <p className="thermal-receipt__section">{t('confirm.customerInformation')}</p>
              <p className="thermal-receipt__line">{order.customer.fullName}</p>
              <p className="thermal-receipt__line">
                {order.customer.address}, {order.customer.city} {order.customer.postalCode}
              </p>
              <p className="thermal-receipt__line">
                {t('confirm.phone')}: {order.customer.phone}
              </p>
            </section>

            <div className="thermal-receipt__cut" />

            <section className="thermal-receipt__block">
              <p className="thermal-receipt__section">
                {t('confirm.orderedProducts', { count: order.lines.length })}
              </p>
              <ul className="thermal-receipt__items">
                {order.lines.map((line) => (
                  <li key={line.lineId} className="thermal-receipt__item">
                    <div className="thermal-receipt__item-row">
                      <span className="thermal-receipt__item-name">{line.productName}</span>
                      <span className="thermal-receipt__strong">
                        {formatMoney(line.lineTotal)}
                      </span>
                    </div>
                    <p className="thermal-receipt__item-meta">
                      {t('confirm.itemMeta', {
                        qty: line.quantity,
                        size: line.size,
                        color: colorLabel(line.color),
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <div className="thermal-receipt__cut" />

            <section className="thermal-receipt__block">
              <div className="thermal-receipt__row">
                <span className="thermal-receipt__muted">{t('common.subtotal')}</span>
                <span>{formatMoney(order.totals.subtotal)}</span>
              </div>
              <div className="thermal-receipt__row">
                <span className="thermal-receipt__muted">{t('common.shipping')}</span>
                <span>
                  {order.totals.shipping === 0
                    ? t('common.freeUpper')
                    : formatMoney(order.totals.shipping)}
                </span>
              </div>
              <div className="thermal-receipt__cut" />
              <div className="thermal-receipt__row thermal-receipt__row--total">
                <span>{t('common.total')}</span>
                <span>{formatMoney(order.totals.total)}</span>
              </div>
            </section>

            <div className="thermal-receipt__cut" />

            <section className="thermal-receipt__block thermal-receipt__center-block">
              <p className="thermal-receipt__thanks">{t('confirm.receiptThanks')}</p>
              <p className="thermal-receipt__muted">{t('confirm.receiptPresent')}</p>
            </section>

            <div className="thermal-receipt__codes">
              <Barcode value={order.orderNumber} />
              <p className="thermal-receipt__code-caption">{order.orderNumber}</p>
              <QrCode value={order.orderId} />
            </div>
          </div>
      </article>
      </div>
      {printed && (
        <div className="receipt-printer__download">
          <DownloadTicketButton ticketNode={ticketNode} orderNumber={order.orderNumber} />
        </div>
      )}
    </div>
  );
};
