import { StatusMessage } from '@/components/feedback/StatusMessage';
import { ButtonLink } from '@/components/ui/Button/Button';
import styles from './EvidencePassport.module.css';

/** Where to go to make a Paspor Bukti; shown whenever a link cannot produce one. */
function EntryLinks() {
  return (
    <span className={styles.actionRow}>
      <ButtonLink to="/jelajahi" variant="secondary">
        Buka Jelajahi
      </ButtonLink>
      <ButtonLink to="/bandingkan" variant="secondary">
        Buka Bandingkan
      </ButtonLink>
      <ButtonLink to="/lab-prioritas" variant="secondary">
        Buka Lab Prioritas
      </ButtonLink>
    </span>
  );
}

export function InvalidLink({ message }: { readonly message: string }) {
  return (
    <StatusMessage
      kind="unavailable"
      title="Paspor Bukti tidak dapat dibuat dari tautan ini"
      action={<EntryLinks />}
    >
      {message} Tidak ada laporan yang dibuat atau ditampilkan.
    </StatusMessage>
  );
}
