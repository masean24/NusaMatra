import { setQualityChoice, useQualityChoice, type QualityChoice } from './graphicsQuality';
import styles from './GraphicsQualitySetting.module.css';

const OPTIONS: readonly { readonly value: QualityChoice; readonly label: string; readonly detail: string }[] =
  [
    {
      value: 'auto',
      label: 'Otomatis',
      detail: 'Dipilih dari jenis perangkat: Tinggi, atau Seimbang di ponsel.',
    },
    { value: 'high', label: 'Tinggi', detail: 'Gambar 3D paling tajam dan semua efek.' },
    {
      value: 'balanced',
      label: 'Seimbang',
      detail: 'Gambar 3D sedikit kurang tajam di layar beresolusi tinggi.',
    },
    {
      value: 'lite',
      label: 'Ringan',
      detail:
        'Untuk perangkat yang tersendat: resolusi 3D dasar, tanpa animasi hiasan, efek kaca lebih ringan.',
    },
  ];

/**
 * "Kualitas grafis": how much the 3D views and glass effects ask of the device. Only the look
 * changes; data, maps and every feature stay the same.
 */
export function GraphicsQualitySetting() {
  const chosen = useQualityChoice();
  return (
    <fieldset className={styles.setting}>
      <legend className="kk-body-strong">Kualitas grafis</legend>
      <p className={`kk-small ${styles.muted}`}>
        Atur bila peta 3D atau efek kaca terasa berat. Data, peta, dan semua fitur tetap sama.
      </p>
      <div className={styles.options}>
        {OPTIONS.map((option) => (
          <label key={option.value} className={styles.option}>
            <input
              type="radio"
              name="kualitas-grafis"
              value={option.value}
              checked={chosen === option.value}
              onChange={() => {
                setQualityChoice(option.value);
              }}
            />
            <strong className={styles.label}>{option.label}</strong>
            <span className={`kk-small ${styles.detail}`}>{option.detail}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
