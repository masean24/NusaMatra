import {
  adminLevelLabel,
  categoryLabel,
  describeObservation,
  formatDecimalId,
  preferredDirectionLabel,
  publicHttpUrl,
} from './formatters';

describe('describeObservation', () => {
  it('shows a measured zero as 0, never as missing', () => {
    expect(describeObservation({ status: 'AVAILABLE', decimal: '0' })).toBe('0');
  });

  it('says the data is not available instead of showing 0', () => {
    expect(describeObservation({ status: 'MISSING', decimal: null, reasonCode: 'NOT_PUBLISHED' })).toBe(
      'Data belum tersedia',
    );
    expect(describeObservation({ status: 'SUPPRESSED', decimal: null, reasonCode: 'X' })).toMatch(
      /tidak dipublikasikan/,
    );
  });

  it('formats numbers the Indonesian way with at most two decimals', () => {
    expect(formatDecimalId('70.6875')).toBe('70,69');
    expect(formatDecimalId('14998.63')).toBe('14.998,63');
    expect(formatDecimalId('not-a-number')).toBe('not-a-number');
  });
});

describe('publicHttpUrl', () => {
  it('keeps web links and drops internal or malformed ones', () => {
    expect(publicHttpUrl('https://webapi.bps.go.id/developer/')).toBe('https://webapi.bps.go.id/developer/');
    expect(publicHttpUrl('internal://nusamatra-data-hub')).toBeNull();
    expect(publicHttpUrl('javascript:alert(1)')).toBeNull();
    expect(publicHttpUrl('bukan url')).toBeNull();
    expect(publicHttpUrl(null)).toBeNull();
  });
});

describe('labels', () => {
  it('names levels, directions and categories in Bahasa Indonesia', () => {
    expect(adminLevelLabel('REGENCY')).toBe('Kabupaten');
    expect(adminLevelLabel('CITY')).toBe('Kota');
    expect(preferredDirectionLabel('HIGHER_IS_WORSE')).toBe('Semakin tinggi, semakin buruk');
    expect(categoryLabel('disaster_risk')).toBe('Risiko bencana');
    expect(categoryLabel('some_new_category')).toBe('Some new category');
  });
});
