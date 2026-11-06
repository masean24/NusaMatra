import { Button } from '@/components/ui/Button/Button';
import { publicHttpUrl, useDataHubResource, type ResourceState } from '@/features/data-hub';
import { downloadTextFile } from '@/lib/downloadTextFile';
import type { AdaptedEnvelope, DataHubIndicatorDTO, IndicatorValuesMapDTO } from '@/services/api';
import { indicatorCsv, indicatorFilename, indicatorJson } from './indicatorExport';
import styles from './IndicatorPanel.module.css';
import { t } from '@/lib/i18n';

interface IndicatorDownloadsProps {
  readonly indicator: DataHubIndicatorDTO;
  readonly referenceYear: number | null;
  readonly values: ResourceState<AdaptedEnvelope<IndicatorValuesMapDTO>>;
}

/**
 * The indicator's values for every region as a file, and the way to its publisher. The file is what
 * the Data Hub holds, built in the browser and said to be a copy; the original stays with the publisher.
 */
export function IndicatorDownloads({ indicator, referenceYear, values }: IndicatorDownloadsProps) {
  const registry = useDataHubResource('registry', (repository, dataMode, signal) =>
    repository.searchRegions({ dataMode, query: '', signal }),
  );
  const portalUrl = publicHttpUrl(indicator.provenance.officialPortalUrl);
  const data = values.status === 'success' ? values.data.data : null;
  const hasValues = data !== null && Object.keys(data.valuesByRegion).length > 0;

  const download = (extension: 'csv' | 'json') => {
    if (!data) return;
    const regions = registry.state.status === 'success' ? registry.state.data.data : [];
    const input = {
      indicator,
      referenceYear,
      values: data,
      regionNames: new Map(regions.map((region) => [region.regionId, region.displayName])),
    };
    downloadTextFile(
      indicatorFilename(indicator.indicatorId, data.snapshotId, extension),
      extension === 'csv' ? indicatorCsv(input) : indicatorJson(input),
      extension === 'csv' ? 'text/csv;charset=utf-8' : 'application/json',
    );
  };

  if (!hasValues && !portalUrl) return null;
  return (
    <section aria-label={t('Unduh data dan sumber indikator')} className={styles.downloads}>
      {hasValues && (
        <div className={styles.downloadActions}>
          <Button
            variant="secondary"
            onClick={() => {
              download('csv');
            }}
          >
            {t('Unduh CSV')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              download('json');
            }}
          >
            {t('Unduh JSON')}
          </Button>
        </div>
      )}
      {portalUrl && (
        <a href={portalUrl} target="_blank" rel="noreferrer noopener" className="kk-small">
          {t('Buka sumber resmi {0}', indicator.provenance.agencyCode)}
          <span className="visually-hidden"> {t('(membuka tab baru)')}</span>
        </a>
      )}
      <p className={`kk-small ${styles.muted}`}>
        {t(
          'Berkas berisi nilai semua kabupaten/kota yang tersimpan di Nusa Matra, bukan berkas asli penerbit. Tautan sumber bisa mengarah ke halaman umum penerbit, bukan langsung ke tabelnya.',
        )}
      </p>
    </section>
  );
}
