/**
 * SMTP configuration for order notifications.
 *
 * Credentials are read from the environment and never leave the server: this
 * module is only imported by the API, so no bundler can pull it into the
 * browser bundle. Nothing here is exposed through an endpoint.
 *
 * When SMTP is not configured the store still takes orders — `isConfigured()`
 * lets the caller skip sending and say so once at boot rather than throwing on
 * every order.
 */

import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Recipient for new-order notifications. Fixed by the store owner; overridable
 * for staging so test orders do not reach the live inbox.
 */
const DEFAULT_STORE_RECIPIENT = 'zakariaqassifi10@gmail.com';

/** Values that indicate an unfilled template rather than a real setting. */
const PLACEHOLDERS = new Set([
  '',
  'user@example.com',
  'password',
  'smtp.example.com',
  'your_email@gmail.com',
  'your_password',
  'changeme',
]);

function setting(name: string, fallback = ''): string {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  return PLACEHOLDERS.has(trimmed.toLowerCase()) ? fallback : trimmed;
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  /** Address the store's notifications are sent to. */
  recipient: string;
  /** Envelope sender; defaults to the authenticated mailbox. */
  fromAddress: string;
  fromName: string;
}

export function emailConfig(): EmailConfig {
  const user = setting('SMTP_USER');
  const pass = setting('SMTP_PASS');
  const host = setting('SMTP_HOST');

  return {
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    // Port 465 is implicit TLS; everything else starts plain and upgrades.
    secure: setting('SMTP_SECURE').toLowerCase() === 'true' ||
      (Number(process.env.SMTP_PORT) === 465),
    user,
    pass,
    recipient: setting('STORE_EMAIL', DEFAULT_STORE_RECIPIENT) || DEFAULT_STORE_RECIPIENT,
    fromAddress: setting('SMTP_FROM', user) || user,
    fromName: setting('STORE_NAME', 'Kinetic Store'),
  };
}

/** True when enough settings exist to attempt a real send. */
export function isConfigured(config: EmailConfig = emailConfig()): boolean {
  return Boolean(config.host && config.user && config.pass);
}

let transporter: Transporter | null = null;

/**
 * Lazily build the shared transporter.
 *
 * Reused across sends so nodemailer keeps one pooled connection. Returns null
 * when SMTP is unconfigured, which callers treat as "skip, do not fail".
 */
export function getTransporter(): Transporter | null {
  const config = emailConfig();
  if (!isConfigured(config)) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });
  }
  return transporter;
}

/** Log once at boot so a missing configuration is visible rather than silent. */
export function warnIfUnconfigured(): void {
  if (!isConfigured()) {
    console.warn(
      '[email] SMTP is not configured (SMTP_HOST / SMTP_USER / SMTP_PASS). ' +
        'Orders will be saved but no notification email will be sent.'
    );
  }
}