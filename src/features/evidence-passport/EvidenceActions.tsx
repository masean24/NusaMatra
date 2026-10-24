import { useState } from 'react';
import { Button } from '@/components/ui/Button/Button';
import { canShare, copyText, downloadTextFile } from './browserActions';

import styles from './EvidencePassport.module.css';

interface EvidenceActionsProps {
  readonly title: string;
  readonly filename: string;
  readonly buildCitationText: () => string;
  readonly buildExportText: () => string;
  /** Address of this page, for the citation and the exported file. */
  readonly link: string;
}

/**
 * The things a reader can really do with a record: print it (or save it as PDF from the print
 * dialog), download it as JSON, copy a citation or the link, and share it where the browser
 * supports that. Every button performs its action or reports why it could not.
 */
export function EvidenceActions({
  title,
  filename,
  buildCitationText,
  buildExportText,
  link,
}: EvidenceActionsProps) {
  const [message, setMessage] = useState('');
  const [manualText, setManualText] = useState<string | null>(null);
  const shareable = canShare();

  const copy = async (text: string, what: string) => {
    const outcome = await copyText(text);
    if (outcome === 'failed') {
      setManualText(text);
      setMessage(`${what} tidak dapat disalin otomatis. Teksnya ditampilkan di bawah; salin secara manual.`);
      return;
    }
    setManualText(null);
    setMessage(`${what} disalin ke papan klip.`);
  };

  const share = async () => {
    try {
      await navigator.share({ title: `Nusa Matra: ${title}`, url: link });
      setMessage('Tautan dibagikan.');
    } catch (error: unknown) {
      // Closing the share sheet is a choice, not a failure.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setMessage('Tautan tidak dapat dibagikan dari peramban ini. Gunakan "Salin tautan".');
    }
  };

  return (
    <section className={styles.actions} aria-label="Tindakan untuk Paspor Bukti">
      <div className={styles.actionRow}>
        <Button
          variant="secondary"
          onClick={() => {
            window.print();
          }}
        >
          Cetak atau simpan PDF
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            downloadTextFile(filename, buildExportText(), 'application/json');
            setMessage(`Berkas ${filename} diunduh dari peramban.`);
          }}
        >
          Unduh JSON
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            void copy(buildCitationText(), 'Sitasi');
          }}
        >
          Salin sitasi
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            void copy(link, 'Tautan');
          }}
        >
          Salin tautan
        </Button>
        {shareable && (
          <Button
            variant="secondary"
            onClick={() => {
              void share();
            }}
          >
            Bagikan
          </Button>
        )}
      </div>
      <p role="status" className="kk-small">
        {message}
      </p>
      {manualText !== null && (
        <label className="kk-small">
          Salin teks ini secara manual
          <textarea
            className={styles.fallbackField}
            readOnly
            value={manualText}
            ref={(element) => {
              element?.focus();
              element?.select();
            }}
          />
        </label>
      )}
    </section>
  );
}
