import { depthClassOf, parseFeltReports, statesTsunamiThreat } from './earthquakeReading';

describe('parseFeltReports', () => {
  it('groups places by intensity, strongest first', () => {
    expect(
      parseFeltReports('III Siberut Barat, III Siberut Utara, II Siberut Tengah, I Kab. Nias Selatan'),
    ).toEqual([
      { scale: 'III', level: 3, places: ['Siberut Barat', 'Siberut Utara'] },
      { scale: 'II', level: 2, places: ['Siberut Tengah'] },
      { scale: 'I', level: 1, places: ['Kab. Nias Selatan'] },
    ]);
  });

  it('keeps a range as BMKG wrote it and reads it by its higher end', () => {
    expect(parseFeltReports('II - III Ternate, II Minahasa')).toEqual([
      { scale: 'II - III', level: 3, places: ['Ternate'] },
      { scale: 'II', level: 2, places: ['Minahasa'] },
    ]);
    expect(parseFeltReports('III Kab. Gorontalo, II - III Kab. Bone Bolango')?.[0]?.scale).toBe('III');
  });

  it('keeps a place that holds a comma whole', () => {
    expect(parseFeltReports('II - III Ruteng, Manggarai')).toEqual([
      { scale: 'II - III', level: 3, places: ['Ruteng, Manggarai'] },
    ]);
  });

  it('does not read a place named like a number as an intensity', () => {
    expect(parseFeltReports('II Solok, X Koto')).toBeNull();
  });

  it('hands back anything else untouched', () => {
    expect(parseFeltReports('Dirasakan di Palu')).toBeNull();
    expect(parseFeltReports(' , ')).toBeNull();
  });
});

describe('depthClassOf', () => {
  it.each([
    [10, 'shallow'],
    [59, 'shallow'],
    [60, 'intermediate'],
    [300, 'intermediate'],
    [301, 'deep'],
  ])('reads %d km as %s', (depth, expected) => {
    expect(depthClassOf(depth)).toBe(expected);
  });
});

describe('statesTsunamiThreat', () => {
  it('tells a threat from its denial and from other notes', () => {
    expect(statesTsunamiThreat('Berpotensi tsunami')).toBe(true);
    expect(statesTsunamiThreat('Tidak berpotensi tsunami')).toBe(false);
    expect(statesTsunamiThreat('Gempa ini dirasakan untuk diteruskan pada masyarakat')).toBe(false);
  });
});
