import { getFileCategory, isPreviewable, getMimeIconName } from './fileTypeHelpers';

describe('getFileCategory', () => {
  it('returns "Image" for image types', () => {
    expect(getFileCategory('image/png')).toBe('Image');
    expect(getFileCategory('image/jpeg')).toBe('Image');
  });

  it('returns "Video" for video types', () => {
    expect(getFileCategory('video/mp4')).toBe('Video');
  });

  it('returns "Audio" for audio types', () => {
    expect(getFileCategory('audio/mpeg')).toBe('Audio');
  });

  it('returns "Document" for document types', () => {
    expect(getFileCategory('application/pdf')).toBe('Document');
    expect(getFileCategory('application/msword')).toBe('Document');
    expect(getFileCategory('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('Document');
    expect(getFileCategory('text/plain')).toBe('Document');
  });

  it('returns "Spreadsheet" for spreadsheet types', () => {
    expect(getFileCategory('application/vnd.ms-excel')).toBe('Spreadsheet');
    expect(getFileCategory('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('Spreadsheet');
    expect(getFileCategory('text/csv')).toBe('Spreadsheet');
  });

  it('returns "Presentation" for presentation types', () => {
    expect(getFileCategory('application/vnd.ms-powerpoint')).toBe('Presentation');
  });

  it('returns "Archive" for archive types', () => {
    expect(getFileCategory('application/zip')).toBe('Archive');
    expect(getFileCategory('application/x-tar')).toBe('Archive');
  });

  it('returns "Code" for code types', () => {
    expect(getFileCategory('application/json')).toBe('Code');
    expect(getFileCategory('text/html')).toBe('Code');
  });

  it('returns "File" as fallback', () => {
    expect(getFileCategory('application/octet-stream')).toBe('File');
    expect(getFileCategory('unknown/type')).toBe('File');
  });
});

describe('isPreviewable', () => {
  it('returns true for image types', () => {
    expect(isPreviewable('image/png')).toBe(true);
    expect(isPreviewable('image/jpeg')).toBe(true);
  });

  it('returns true for video types', () => {
    expect(isPreviewable('video/mp4')).toBe(true);
  });

  it('returns true for PDF', () => {
    expect(isPreviewable('application/pdf')).toBe(true);
  });

  it('returns false for non-previewable types', () => {
    expect(isPreviewable('audio/mpeg')).toBe(false);
    expect(isPreviewable('application/zip')).toBe(false);
    expect(isPreviewable('text/plain')).toBe(false);
  });
});

describe('getMimeIconName', () => {
  it('returns "Image" for image types', () => {
    expect(getMimeIconName('image/png')).toBe('Image');
  });

  it('returns "VideoFile" for video types', () => {
    expect(getMimeIconName('video/mp4')).toBe('VideoFile');
  });

  it('returns "AudioFile" for audio types', () => {
    expect(getMimeIconName('audio/mpeg')).toBe('AudioFile');
  });

  it('returns "PictureAsPdf" for PDF', () => {
    expect(getMimeIconName('application/pdf')).toBe('PictureAsPdf');
  });

  it('returns "FolderZip" for archive types', () => {
    expect(getMimeIconName('application/zip')).toBe('FolderZip');
    expect(getMimeIconName('application/x-tar')).toBe('FolderZip');
  });

  it('returns "TableChart" for spreadsheet types', () => {
    expect(getMimeIconName('application/vnd.ms-excel')).toBe('TableChart');
    expect(getMimeIconName('text/csv')).toBe('TableChart');
  });

  it('returns "Description" for Word docs', () => {
    expect(getMimeIconName('application/msword')).toBe('Description');
    expect(getMimeIconName('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('Description');
  });

  it('returns "Code" for code types', () => {
    expect(getMimeIconName('application/json')).toBe('Code');
    expect(getMimeIconName('text/html')).toBe('Code');
  });

  it('returns "InsertDriveFile" as fallback', () => {
    expect(getMimeIconName('application/octet-stream')).toBe('InsertDriveFile');
    expect(getMimeIconName('unknown/type')).toBe('InsertDriveFile');
  });
});
