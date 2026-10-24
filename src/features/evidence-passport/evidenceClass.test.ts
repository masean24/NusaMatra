import { classifyEvidence, evidenceClassLabel } from './evidenceClass';

const base = { flag: 'VERIFIED', isDemoExample: false, catalogAvailability: 'DIRECT', catalogLoaded: true };

describe('classifyEvidence', () => {
  it('VERIFIED only when the server says so and the catalog lists a direct figure', () => {
    expect(classifyEvidence(base)).toEqual({ evidenceClass: 'VERIFIED', note: null });
  });

  it('DERIVED comes from the catalog join, not from the flag', () => {
    expect(classifyEvidence({ ...base, catalogAvailability: 'DERIVED' }).evidenceClass).toBe('DERIVED');
  });

  it('does not guess VERIFIED when the catalog is missing', () => {
    const result = classifyEvidence({ ...base, catalogAvailability: null, catalogLoaded: false });
    expect(result.evidenceClass).toBe('UNSPECIFIED');
    expect(result.note).toContain('katalog');
  });

  it('IMPUTED_PROVINCE wins over a direct catalog entry and says it is not a measurement', () => {
    const result = classifyEvidence({ ...base, flag: 'IMPUTED_PROVINCE' });
    expect(result.evidenceClass).toBe('IMPUTED_PROVINCE');
    expect(result.note).toMatch(/provinsi/i);
  });

  it('DEMO_EXAMPLE wins over everything', () => {
    expect(classifyEvidence({ ...base, flag: 'DEMO_EXAMPLE', isDemoExample: true }).evidenceClass).toBe(
      'DEMO_EXAMPLE',
    );
    expect(classifyEvidence({ ...base, isDemoExample: true }).evidenceClass).toBe('DEMO_EXAMPLE');
  });

  it('shows an unknown flag exactly as sent and an absent flag as unspecified', () => {
    const other = classifyEvidence({ ...base, flag: 'PROVISIONAL' });
    expect(other.evidenceClass).toBe('OTHER_FLAG');
    expect(evidenceClassLabel('OTHER_FLAG', 'PROVISIONAL')).toBe('PROVISIONAL');
    expect(classifyEvidence({ ...base, flag: null }).evidenceClass).toBe('UNSPECIFIED');
  });
});
