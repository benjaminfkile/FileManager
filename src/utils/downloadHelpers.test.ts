import { triggerDownloadFromUrl, triggerDownloadFromBlob } from './downloadHelpers';

describe('downloadHelpers', () => {
  let anchorEl: HTMLAnchorElement;
  let appendChildSpy: jest.SpyInstance;

  beforeEach(() => {
    anchorEl = document.createElement('a');
    anchorEl.click = jest.fn();
    anchorEl.remove = jest.fn();
    jest.spyOn(document, 'createElement').mockReturnValue(anchorEl);
    appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);

    // jsdom doesn't provide URL.createObjectURL / revokeObjectURL
    if (!URL.createObjectURL) {
      URL.createObjectURL = jest.fn();
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = jest.fn();
    }
    jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/fake-uuid');
    jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('triggerDownloadFromUrl', () => {
    it('creates a temporary anchor with the given URL and clicks it', () => {
      triggerDownloadFromUrl('https://cdn.example.com/signed-url');

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(anchorEl.href).toBe('https://cdn.example.com/signed-url');
      expect(appendChildSpy).toHaveBeenCalledWith(anchorEl);
      expect(anchorEl.click).toHaveBeenCalled();
      expect(anchorEl.remove).toHaveBeenCalled();
    });

    it('sets the download attribute when filename is provided', () => {
      triggerDownloadFromUrl('https://cdn.example.com/signed-url', 'report.pdf');

      expect(anchorEl.download).toBe('report.pdf');
    });

    it('does not set download attribute when filename is omitted', () => {
      triggerDownloadFromUrl('https://cdn.example.com/signed-url');

      expect(anchorEl.download).toBe('');
    });
  });

  describe('triggerDownloadFromBlob', () => {
    it('creates an object URL from the blob, clicks, and revokes', () => {
      const blob = new Blob(['zip-content'], { type: 'application/zip' });
      triggerDownloadFromBlob(blob, 'Documents.zip');

      expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
      expect(anchorEl.href).toBe('blob:http://localhost/fake-uuid');
      expect(anchorEl.download).toBe('Documents.zip');
      expect(appendChildSpy).toHaveBeenCalledWith(anchorEl);
      expect(anchorEl.click).toHaveBeenCalled();
      expect(anchorEl.remove).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/fake-uuid');
    });
  });
});
