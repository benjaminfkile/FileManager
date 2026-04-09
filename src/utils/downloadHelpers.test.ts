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
    it('fetches the URL, creates a blob object URL, and triggers download', async () => {
      const fakeBlob = new Blob(['file content'], { type: 'image/png' });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(fakeBlob),
      } as unknown as Response);

      await triggerDownloadFromUrl('https://cdn.example.com/signed-url', 'photo.png');

      expect(global.fetch).toHaveBeenCalledWith('https://cdn.example.com/signed-url');
      expect(URL.createObjectURL).toHaveBeenCalledWith(fakeBlob);
      expect(anchorEl.download).toBe('photo.png');
      expect(anchorEl.click).toHaveBeenCalled();
    });

    it('falls back to window.open if fetch fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network error'));
      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

      await triggerDownloadFromUrl('https://cdn.example.com/signed-url', 'photo.png');

      expect(openSpy).toHaveBeenCalledWith(
        'https://cdn.example.com/signed-url',
        '_blank',
        'noopener,noreferrer',
      );
    });

    it('uses "download" as fallback filename when none provided', async () => {
      const fakeBlob = new Blob(['data']);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(fakeBlob),
      } as unknown as Response);

      await triggerDownloadFromUrl('https://cdn.example.com/signed-url');

      expect(anchorEl.download).toBe('download');
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
