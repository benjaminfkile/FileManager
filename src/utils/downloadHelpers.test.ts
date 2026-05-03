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
    it('clicks a hidden anchor pointing at the URL — no fetch, no buffering', async () => {
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy;

      await triggerDownloadFromUrl('https://cdn.example.com/signed-url', 'photo.png');

      // Critical: bytes must NOT flow through JavaScript.
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(URL.createObjectURL).not.toHaveBeenCalled();

      expect(anchorEl.href).toBe('https://cdn.example.com/signed-url');
      expect(anchorEl.download).toBe('photo.png');
      expect(appendChildSpy).toHaveBeenCalledWith(anchorEl);
      expect(anchorEl.click).toHaveBeenCalled();
      expect(anchorEl.remove).toHaveBeenCalled();
    });

    it('omits the download attribute when no filename is provided', async () => {
      await triggerDownloadFromUrl('https://cdn.example.com/signed-url');
      expect(anchorEl.download).toBe('');
      expect(anchorEl.click).toHaveBeenCalled();
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
