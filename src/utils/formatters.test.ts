import { formatFileSize, formatDate, formatDateTime } from './formatters';

describe('formatFileSize', () => {
  it('returns "0 B" for 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('returns bytes for values under 1024', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('returns KB for values under 1 048 576', () => {
    expect(formatFileSize(1500)).toBe('1.5 KB');
  });

  it('returns MB for values under 1 073 741 824', () => {
    expect(formatFileSize(2000000)).toBe('1.9 MB');
  });

  it('returns GB for values >= 1 073 741 824', () => {
    expect(formatFileSize(2000000000)).toBe('1.86 GB');
  });
});

describe('formatDate', () => {
  it('returns a human-readable date string', () => {
    expect(formatDate('2026-04-08T15:45:00Z')).toBe('Apr 8, 2026');
  });
});

describe('formatDateTime', () => {
  it('returns a human-readable date and time string', () => {
    const result = formatDateTime('2026-04-08T15:45:00Z');
    // The exact output depends on the runtime timezone, so check the date portion
    // and that it includes PM time
    expect(result).toContain('Apr 8, 2026');
    expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/);
  });
});
