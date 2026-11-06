import { useEffect, useState } from 'react';
import { downloadTextFile } from '@/lib/downloadTextFile';
import { canShare, copyText } from './browserActions';
import { t } from '@/lib/i18n';

const LINK_COPIED_MS = 1600;

interface PassportActionsInput {
  readonly title: string;
  readonly filename: string;
  /** Address of this page, naming the pinned snapshot. */
  readonly link: string;
  readonly buildCitationText: () => string;
  readonly buildExportText: () => string;
}

/**
 * What a reader can do with a record: copy the link or the citation, download the JSON, share, print.
 * Every action reports its outcome in `message`; a copy the browser refuses leaves the text in
 * `manualText` to copy by hand.
 */
export function usePassportActions({
  title,
  filename,
  link,
  buildCitationText,
  buildExportText,
}: PassportActionsInput) {
  const [message, setMessage] = useState('');
  const [manualText, setManualText] = useState<string | null>(null);
  // "Salin tautan" reads "Tautan tersalin" for a moment after a successful copy.
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!linkCopied) return;
    const timer = window.setTimeout(() => {
      setLinkCopied(false);
    }, LINK_COPIED_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [linkCopied]);

  const copy = async (text: string, what: string): Promise<boolean> => {
    const outcome = await copyText(text);
    if (outcome === 'failed') {
      setManualText(text);
      setMessage(
        t('{0} tidak dapat disalin otomatis. Teksnya ditampilkan di bawah; salin secara manual.', what),
      );
      return false;
    }
    setManualText(null);
    setMessage(t('{0} disalin ke papan klip.', what));
    return true;
  };

  const share = async () => {
    try {
      await navigator.share({ title: t('Nusa Matra: {0}', title), url: link });
      setMessage(t('Tautan dibagikan.'));
    } catch (error: unknown) {
      // Closing the share sheet is a choice, not a failure.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setMessage(t('Tautan tidak dapat dibagikan dari peramban ini. Gunakan "Salin tautan".'));
    }
  };

  return {
    message,
    manualText,
    linkCopied,
    shareable: canShare(),
    copyLink: () => {
      void copy(link, t('Tautan')).then(setLinkCopied);
    },
    copyCitation: () => {
      void copy(buildCitationText(), t('Kutipan'));
    },
    copyDigest: (digest: string) => {
      void copy(digest, t('Sidik isi data'));
    },
    download: () => {
      downloadTextFile(filename, buildExportText(), 'application/json');
      setMessage(t('Berkas {0} diunduh dari peramban.', filename));
    },
    print: () => {
      window.print();
    },
    share: () => {
      void share();
    },
  };
}

export type PassportActions = ReturnType<typeof usePassportActions>;
