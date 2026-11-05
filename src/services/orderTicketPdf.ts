/**
 * Order ticket PDF export.
 *
 * Converts the rendered thermal-receipt DOM node into a high-resolution
 * bitmap (html2canvas) and lays it onto an A4 page with jsPDF so the
 * downloaded file looks exactly like the ticket on screen, in every
 * locale/RTL, without embedding fonts.
 */

type CloneSanitizer = (doc: Document) => void;

const PAPER_BG = '#fdfcf9';
const A4 = { width: 210, height: 297 };
const BRANDING = 'KINETIC STUDIO';

function stripAnimations(doc: Document): void {
  doc
    .querySelectorAll<HTMLElement>('.thermal-receipt, .thermal-receipt__shiver')
    .forEach((el) => {
      el.style.animation = 'none';
      el.style.transform = 'none';
    });
}

async function rasterizeTicket(
  node: HTMLElement,
  onclone: CloneSanitizer
): Promise<HTMLCanvasElement> {
  const html2canvas = (await import('html2canvas')).default;
  return html2canvas(node, {
    scale: 2,
    backgroundColor: PAPER_BG,
    logging: false,
    onclone,
  });
}

/** Generate the A4 PDF for a ticket node and trigger the browser download. */
export async function downloadOrderTicketPdf(node: HTMLElement, orderNumber: string): Promise<void> {
  const canvas = await rasterizeTicket(node, stripAnimations);
  const { jsPDF } = await import('jspdf');

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  const margin = 14;
  const maxWidth = A4.width - margin * 2;
  let width = Math.min(maxWidth, 108);
  let height = (width * canvas.height) / canvas.width;
  if (height > A4.height - margin * 2) {
    const k = (A4.height - margin * 2) / height;
    width *= k;
    height *= k;
  }

  pdf.addImage(
    canvas.toDataURL('image/png'),
    'PNG',
    (A4.width - width) / 2,
    margin - 4,
    width,
    height
  );

  pdf.setFont('courier', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(130);
  pdf.text(`${BRANDING} — ${orderNumber}`, A4.width / 2, A4.height - 8, { align: 'center' });

  pdf.save(`kinetic-checkout-ticket-${orderNumber}.pdf`);
}
