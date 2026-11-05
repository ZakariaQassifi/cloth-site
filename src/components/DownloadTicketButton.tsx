import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useTranslation } from '../i18n/useI18n';
import { downloadOrderTicketPdf } from '../services/orderTicketPdf';
import './DownloadTicketButton.css';

export interface DownloadTicketButtonProps {
  /** The rendered ticket node to rasterize into the PDF. */
  ticketNode: HTMLElement | null;
  orderNumber: string;
}

type ButtonState = 'idle' | 'busy' | 'error';

export const DownloadTicketButton: React.FC<DownloadTicketButtonProps> = ({
  ticketNode,
  orderNumber,
}) => {
  const { t } = useTranslation();
  const [state, setState] = useState<ButtonState>('idle');

  const isBusy = state === 'busy';

  async function handleClick(): Promise<void> {
    if (!ticketNode || isBusy) return;
    setState('busy');
    try {
      await downloadOrderTicketPdf(ticketNode, orderNumber);
      setState('idle');
    } catch {
      setState('error');
      window.setTimeout(() => setState('idle'), 3200);
    }
  }

  return (
    <div className="download-ticket">
      <button
        type="button"
        className="download-ticket__button"
        onClick={() => void handleClick()}
        disabled={!ticketNode || isBusy}
        aria-busy={isBusy}
      >
        {isBusy ? (
          <Loader2 size={17} className="download-ticket__spin" aria-hidden="true" />
        ) : (
          <Download size={17} aria-hidden="true" />
        )}
        <span>{isBusy ? t('confirm.downloadPreparing') : t('confirm.downloadTicket')}</span>
      </button>
      {state === 'error' && (
        <p className="download-ticket__error" role="alert">
          {t('confirm.downloadError')}
        </p>
      )}
    </div>
  );
};
