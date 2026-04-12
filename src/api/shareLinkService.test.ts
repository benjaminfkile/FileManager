import MockAdapter from 'axios-mock-adapter';
import apiClient from './apiClient';
import {
  createFileShareLink,
  revokeFileShareLink,
  getFileShareLink,
  createFolderShareLink,
  revokeFolderShareLink,
  getFolderShareLink,
  resolveShareLink,
} from './shareLinkService';
import { IShareLink, IShareLinkResolution } from '../types';

const mock = new MockAdapter(apiClient);

afterEach(() => {
  mock.reset();
});

const fakeShareLink: IShareLink = {
  id: 'sl-1',
  token: 'abc123',
  file_id: 'file-1',
  folder_id: null,
  created_by_user_id: 'u-1',
  expires_at: '2026-12-31T23:59:59.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
};

const fakeFolderShareLink: IShareLink = {
  id: 'sl-2',
  token: 'def456',
  file_id: null,
  folder_id: 'folder-1',
  created_by_user_id: 'u-1',
  expires_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
};

const fakeResolution: IShareLinkResolution = {
  type: 'file',
  name: 'document.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 2048,
  downloadUrl: 'https://example.com/download/abc123',
};

describe('createFileShareLink', () => {
  it('POSTs /api/files/:id/link with expiresInSeconds and returns the share link', async () => {
    mock.onPost('/api/files/file-1/link').reply(200, fakeShareLink);

    const result = await createFileShareLink('file-1', 3600);

    expect(result).toEqual(fakeShareLink);
    expect(mock.history.post).toHaveLength(1);
    expect(mock.history.post[0].url).toBe('/api/files/file-1/link');
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ expiresInSeconds: 3600 });
  });

  it('sends null expiresInSeconds for non-expiring links', async () => {
    mock.onPost('/api/files/file-1/link').reply(200, fakeShareLink);

    await createFileShareLink('file-1', null);

    expect(JSON.parse(mock.history.post[0].data)).toEqual({ expiresInSeconds: null });
  });
});

describe('revokeFileShareLink', () => {
  it('DELETEs /api/files/:id/link', async () => {
    mock.onDelete('/api/files/file-1/link').reply(204);

    await revokeFileShareLink('file-1');

    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.delete[0].url).toBe('/api/files/file-1/link');
  });
});

describe('getFileShareLink', () => {
  it('GETs /api/files/:id/link and unwraps shareLink', async () => {
    mock.onGet('/api/files/file-1/link').reply(200, { shareLink: fakeShareLink });

    const result = await getFileShareLink('file-1');

    expect(result).toEqual(fakeShareLink);
    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].url).toBe('/api/files/file-1/link');
  });

  it('returns null when no share link exists', async () => {
    mock.onGet('/api/files/file-1/link').reply(200, { shareLink: null });

    const result = await getFileShareLink('file-1');

    expect(result).toBeNull();
  });
});

describe('createFolderShareLink', () => {
  it('POSTs /api/folders/:id/link with expiresInSeconds and returns the share link', async () => {
    mock.onPost('/api/folders/folder-1/link').reply(200, fakeFolderShareLink);

    const result = await createFolderShareLink('folder-1', null);

    expect(result).toEqual(fakeFolderShareLink);
    expect(mock.history.post).toHaveLength(1);
    expect(mock.history.post[0].url).toBe('/api/folders/folder-1/link');
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ expiresInSeconds: null });
  });
});

describe('revokeFolderShareLink', () => {
  it('DELETEs /api/folders/:id/link', async () => {
    mock.onDelete('/api/folders/folder-1/link').reply(204);

    await revokeFolderShareLink('folder-1');

    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.delete[0].url).toBe('/api/folders/folder-1/link');
  });
});

describe('getFolderShareLink', () => {
  it('GETs /api/folders/:id/link and unwraps shareLink', async () => {
    mock.onGet('/api/folders/folder-1/link').reply(200, { shareLink: fakeFolderShareLink });

    const result = await getFolderShareLink('folder-1');

    expect(result).toEqual(fakeFolderShareLink);
    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].url).toBe('/api/folders/folder-1/link');
  });

  it('returns null when no share link exists', async () => {
    mock.onGet('/api/folders/folder-1/link').reply(200, { shareLink: null });

    const result = await getFolderShareLink('folder-1');

    expect(result).toBeNull();
  });
});

describe('resolveShareLink', () => {
  it('GETs /api/links/:token and returns the resolution', async () => {
    mock.onGet('/api/links/abc123').reply(200, fakeResolution);

    const result = await resolveShareLink('abc123');

    expect(result).toEqual(fakeResolution);
    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].url).toBe('/api/links/abc123');
  });
});
