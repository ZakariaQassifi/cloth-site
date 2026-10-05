/**
 * Brand configuration — single source of truth for contact/support info.
 *
 * All storefront, admin, and email templates should read from here so the
 * store owner can update email/phone in one place.
 */

export interface BrandConfig {
  name: string;
  supportEmail: string;
  supportPhone: string;
  address?: string;
}

export const brandConfig: BrandConfig = {
  name: 'KINETIC STUDIO',
  supportEmail: 'support@kineticstudio.ma',
  supportPhone: '+212 5 22 00 00 00',
  address: '123 Avenue Mohammed V, Casablanca, Morocco',
};