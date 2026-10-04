/**
 * Order notification emails.
 *
 * Sends the store a summary of each Cash on Delivery order. Everything here
 * runs server-side; the browser only sees "order created".
 *
 * Two details worth keeping in mind when editing:
 *  - Customer-supplied text (name, address, notes) is HTML-escaped before it is
 *    interpolated into the message, so a crafted field cannot inject markup into
 *    the store owner's inbox.
 *  - Sending is best-effort. A mail failure must never roll back or fail an
 *    order that is already committed to the database.
 */

import type { Prisma } from '@prisma/client';
import { emailConfig, getTransporter, isConfigured } from './emailConfig';

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

/** Accent colour reused from the storefront identity. */
const INK = '#111827';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';

/**
 * Escape text for safe interpolation into HTML email bodies.
 * Covers the five characters that matter for markup and attribute contexts.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format a number as a price with exactly two decimals. */
export function formatAmount(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

/**
 * Short human-facing reference, e.g. KNT-1A2B3C4D.
 * The full order id is also included in the body so it can be looked up exactly.
 */
export function shortOrderId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

/**
 * Subject lines are plain text but still travel as headers, so strip anything
 * that could terminate a header or bloat it, then cap the length.
 */
export function subjectSafe(value: unknown, maxLength = 60): string {
  let out = '';
  for (const ch of String(value ?? '')) {
    const code = ch.codePointAt(0) ?? 0;
    // Line breaks and Unicode separators become spaces so words stay separated;
    // other control characters are dropped outright.
    if (ch === '\r' || ch === '\n' || ch === '\u2028' || ch === '\u2029') out += ' ';
    else if (code >= 0x20 && code !== 0x7f) out += ch;
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

/**
 * Product images are stored as absolute URLs already, but uploads created on a
 * developer machine point at localhost, which an email client cannot load.
 * Fall back to the bundled placeholder rather than emitting a broken image.
 */
function usableImageUrl(url: string): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) && !/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(url)) {
    return url;
  }
  return null;
}

/** One row of the items table. */
function itemRow(item: OrderWithItems['items'][number]): string {
  const image = usableImageUrl(item.productImage);
  const imageCell = image
    ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.productName)}" width="56" height="56" style="display:block;object-fit:cover;border-radius:6px;border:1px solid ${LINE};" />`
    : `<div style="width:56px;height:56px;border-radius:6px;border:1px solid ${LINE};background:#f9fafb;"></div>`;

  const lineTotal = formatAmount(item.totalPrice);

  return `
    <tr>
      <td style="padding:12px;border-bottom:1px solid ${LINE};vertical-align:top;">${imageCell}</td>
      <td style="padding:12px;border-bottom:1px solid ${LINE};vertical-align:top;">
        <div style="font-weight:600;color:${INK};">${escapeHtml(item.productName)}</div>
        <div style="font-size:12px;color:${MUTED};margin-top:2px;">
          Size: ${escapeHtml(item.size)} &middot; Color: ${escapeHtml(item.color)}
        </div>
        <div style="font-size:12px;color:${MUTED};margin-top:2px;">
          ${formatAmount(item.unitPrice)} each
        </div>
      </td>
      <td style="padding:12px;border-bottom:1px solid ${LINE};text-align:center;vertical-align:top;">${escapeHtml(item.quantity)}</td>
      <td style="padding:12px;border-bottom:1px solid ${LINE};text-align:right;vertical-align:top;font-weight:600;white-space:nowrap;">${lineTotal}</td>
    </tr>`;
}

/** Label/value pair used by the customer details block. */
function detailRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:6px 12px 6px 0;color:${MUTED};font-size:13px;white-space:nowrap;vertical-align:top;">${label}</td>
      <td style="padding:6px 0;color:${INK};font-size:14px;font-weight:600;">${value}</td>
    </tr>`;
}

/** Full order summary addressed to the store. */
export function buildStoreEmailHtml(order: OrderWithItems): string {
  const reference = shortOrderId(order.id);

  const items = order.items.map(itemRow).join('');

  const locationParts = [
    order.customerAddress,
    order.customerCity,
    order.customerPostalCode,
  ].filter(Boolean);

  const details = [
    detailRow('Customer', escapeHtml(order.customerName)),
    detailRow('Phone', escapeHtml(order.customerPhone)),
    detailRow('Email', escapeHtml(order.customerEmail)),
    detailRow(
      'Address',
      escapeHtml(locationParts.join(', '))
    ),
    order.customerNotes ? detailRow('Notes', escapeHtml(order.customerNotes)) : '',
  ].join('');

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border:1px solid ${LINE};border-radius:8px;overflow:hidden;">
      <div style="background:${INK};color:#ffffff;padding:20px 24px;">
        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.75;">Kinetic Store</div>
        <h1 style="margin:6px 0 0;font-size:20px;letter-spacing:0.04em;">New Cash on Delivery order</h1>
        <div style="margin-top:6px;font-size:13px;opacity:0.85;">Reference ${reference}</div>
      </div>

      <div style="padding:24px;">
        <table role="presentation" style="width:100%;border-collapse:collapse;">${details}</table>

        <div style="margin-top:24px;border-top:2px solid ${INK};padding-top:16px;">
          <h2 style="margin:0 0 12px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED};">Items</h2>
          <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="background:#f9fafb;text-align:left;">
                <th style="padding:10px 12px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};">Image</th>
                <th style="padding:10px 12px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};">Product</th>
                <th style="padding:10px 12px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};text-align:center;">Qty</th>
                <th style="padding:10px 12px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>${items}</tbody>
          </table>
        </div>

        <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:20px;">
          <tr>
            <td style="padding:6px 0;color:${MUTED};font-size:13px;">Subtotal</td>
            <td style="padding:6px 0;text-align:right;font-size:14px;">${formatAmount(order.subtotalPrice)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:${MUTED};font-size:13px;">Shipping</td>
            <td style="padding:6px 0;text-align:right;font-size:14px;">${
              order.shippingPrice > 0 ? formatAmount(order.shippingPrice) : 'Free'
            }</td>
          </tr>
          <tr>
            <td style="padding:12px 0;border-top:1px solid ${LINE};font-weight:600;">Total</td>
            <td style="padding:12px 0;border-top:1px solid ${LINE};text-align:right;font-weight:700;font-size:18px;">${formatAmount(order.totalPrice)}</td>
          </tr>
        </table>

        <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:20px;background:#f9fafb;border:1px solid ${LINE};border-radius:6px;">
          <tr>
            <td style="padding:12px;font-size:12px;color:${MUTED};">
              Order ID<br />
              <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:${INK};word-break:break-all;">${escapeHtml(order.id)}</span>
            </td>
            <td style="padding:12px;font-size:12px;color:${MUTED};text-align:right;">
              Payment<br />
              <span style="font-size:13px;color:${INK};font-weight:600;">Cash on Delivery</span>
            </td>
          </tr>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/** Short acknowledgement sent to the customer. */
function buildCustomerEmailHtml(order: OrderWithItems): string {
  const items = order.items
    .map(
      (item) =>
        `<li style="margin:4px 0;">${escapeHtml(item.quantity)} &times; ${escapeHtml(item.productName)} (${escapeHtml(item.size)}, ${escapeHtml(item.color)})</li>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border:1px solid ${LINE};border-radius:8px;padding:24px;">
      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${MUTED};">Kinetic Store</div>
      <h1 style="margin:8px 0 12px;font-size:20px;">Thank you for your order</h1>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;">
        Hi ${escapeHtml(order.customerName)}, we have received your order and will contact you to confirm delivery.
      </p>
      <p style="margin:0 0 8px;font-size:14px;">
        <strong>Order reference:</strong> ${shortOrderId(order.id)}
      </p>
      <p style="margin:0 0 8px;font-size:14px;">
        <strong>Total:</strong> ${formatAmount(order.totalPrice)} &mdash; Cash on Delivery
      </p>
      <ul style="margin:16px 0 0;padding-left:20px;font-size:14px;color:#374151;">${items}</ul>
    </div>
  </div>
</body>
</html>`;
}

export interface NotificationResult {
  /** False when SMTP is not configured, so no send was attempted. */
  attempted: boolean;
  /** True only when the store notification was accepted by the SMTP server. */
  storeEmailSent: boolean;
  customerEmailSent: boolean;
  /** Provider message id for the store notification, when available. */
  messageId?: string;
  /** Why the send failed, for logging. Never shown to the customer. */
  error?: string;
}

/**
 * Notify the store (and optionally the customer) about a new order.
 *
 * Never throws: the order is already saved, so a mail problem is logged and
 * reported through the return value rather than propagated to the API caller.
 */
export async function sendOrderNotifications(
  order: OrderWithItems
): Promise<NotificationResult> {
  const config = emailConfig();
  const transporter = getTransporter();

  if (!transporter || !isConfigured(config)) {
    return {
      attempted: false,
      storeEmailSent: false,
      customerEmailSent: false,
      error: 'SMTP is not configured',
    };
  }

  const from = `"${config.fromName}" <${config.fromAddress}>`;

  try {
    const storeResult = await transporter.sendMail({
      from,
      to: config.recipient,
      replyTo: order.customerEmail,
      subject: `New COD order ${shortOrderId(order.id)} — ${subjectSafe(order.customerName)}`,
      html: buildStoreEmailHtml(order),
    });

    console.log(
      `[email] order notification sent to ${config.recipient} (messageId: ${storeResult.messageId})`
    );

    // The customer copy is a courtesy; a failure here must not affect the result.
    let customerEmailSent = false;
    if (order.customerEmail) {
      try {
        await transporter.sendMail({
          from,
          to: order.customerEmail,
          subject: `Order confirmation ${shortOrderId(order.id)}`,
          html: buildCustomerEmailHtml(order),
        });
        customerEmailSent = true;
      } catch (customerError) {
        console.warn('[email] customer confirmation failed:', customerError);
      }
    }

    return {
      attempted: true,
      storeEmailSent: true,
      customerEmailSent,
      messageId: storeResult.messageId,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[email] order notification failed for ${order.id}:`, detail);
    return {
      attempted: true,
      storeEmailSent: false,
      customerEmailSent: false,
      error: detail,
    };
  }
}