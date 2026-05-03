import MockAdapter from 'axios-mock-adapter';
import apiClient from './apiClient';
import {
  initiateUpload,
  getPartUrls,
  uploadPartToUrl,
  completeUpload,
  abortUpload,
} from './chunkedUploadService';
import { IFile } from '../types';

const mock = new MockAdapter(apiClient);

afterEach(() => {
  mock.reset();
});

const fakeFile: IFile = {
  id: 'file-1',
  user_id: 'u-1',
  folder_id: 'f-1',
  name: 'document.pdf',
  s3_key: 'uploads/document.pdf',
  size_bytes: 1024,
  mime_type: 'application/pdf',
  is_deleted: false,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('initiateUpload', () => {
  it('POSTs to /api/files/uploads/initiate with the correct body', async () => {
    const response = { uploadId: 'upload-1', fileId: 'file-1', key: 'uploads/document.pdf' };
    mock.onPost('/api/files/uploads/initiate').reply(200, response);

    const payload = { filename: 'document.pdf', mimeType: 'application/pdf', size: 1024, folderId: 'f-1' };
    const result = await initiateUpload(payload);

    expect(result).toEqual(response);
    expect(mock.history.post).toHaveLength(1);
    expect(mock.history.post[0].url).toBe('/api/files/uploads/initiate');
    expect(JSON.parse(mock.history.post[0].data)).toEqual(payload);
  });

  it('returns { uploadId, fileId, key }', async () => {
    const response = { uploadId: 'upload-2', fileId: 'file-2', key: 'uploads/photo.png' };
    mock.onPost('/api/files/uploads/initiate').reply(200, response);

    const result = await initiateUpload({ filename: 'photo.png', mimeType: 'image/png', size: 2048 });

    expect(result).toHaveProperty('uploadId', 'upload-2');
    expect(result).toHaveProperty('fileId', 'file-2');
    expect(result).toHaveProperty('key', 'uploads/photo.png');
  });
});

describe('getPartUrls', () => {
  it('POSTs to /api/files/uploads/{fileId}/part-urls and returns urls[]', async () => {
    const response = {
      urls: [
        { partNumber: 1, url: 'https://s3.example/put?part=1' },
        { partNumber: 2, url: 'https://s3.example/put?part=2' },
      ],
      expiresAt: '2026-05-04T01:00:00Z',
    };
    mock.onPost('/api/files/uploads/file-1/part-urls').reply(200, response);

    const result = await getPartUrls('file-1', [1, 2]);

    expect(result).toEqual(response.urls);
    expect(mock.history.post).toHaveLength(1);
    expect(mock.history.post[0].url).toBe('/api/files/uploads/file-1/part-urls');
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ partNumbers: [1, 2] });
  });
});

describe('uploadPartToUrl', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('PUTs the chunk to the presigned URL and returns ETag from response headers', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Map([['ETag', '"abc123"']]),
    } as unknown as Response);
    // jsdom Headers polyfill works differently — provide a get() shim that
    // matches the contract `uploadPartToUrl` uses.
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: { get: (k: string) => (k.toLowerCase() === 'etag' ? '"abc123"' : null) },
    });

    const chunk = new Blob([Buffer.from('hello')], { type: 'application/octet-stream' });
    const result = await uploadPartToUrl({
      url: 'https://s3.example/put?part=1',
      partNumber: 1,
      chunk,
    });

    expect(result).toEqual({ partNumber: 1, etag: '"abc123"' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://s3.example/put?part=1',
      expect.objectContaining({ method: 'PUT', body: chunk }),
    );
  });

  it('throws when the response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers: { get: () => null },
    } as unknown as Response);

    const chunk = new Blob([Buffer.from('x')]);
    await expect(
      uploadPartToUrl({ url: 'https://s3.example/put', partNumber: 1, chunk }),
    ).rejects.toThrow(/403/);
  });

  it('throws when the response is missing the ETag header', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
    } as unknown as Response);

    const chunk = new Blob([Buffer.from('x')]);
    await expect(
      uploadPartToUrl({ url: 'https://s3.example/put', partNumber: 1, chunk }),
    ).rejects.toThrow(/ETag/);
  });
});

describe('completeUpload', () => {
  it('POSTs to /api/files/uploads/{fileId}/complete with { parts }', async () => {
    mock.onPost('/api/files/uploads/file-1/complete').reply(200, fakeFile);

    const parts = [
      { partNumber: 1, etag: '"abc123"' },
      { partNumber: 2, etag: '"def456"' },
    ];
    const result = await completeUpload('file-1', parts);

    expect(result).toEqual(fakeFile);
    expect(mock.history.post).toHaveLength(1);
    expect(mock.history.post[0].url).toBe('/api/files/uploads/file-1/complete');
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ parts });
  });

  it('returns the file record', async () => {
    mock.onPost('/api/files/uploads/file-1/complete').reply(200, fakeFile);

    const result = await completeUpload('file-1', [{ partNumber: 1, etag: '"abc"' }]);

    expect(result).toHaveProperty('id', 'file-1');
    expect(result).toHaveProperty('name', 'document.pdf');
    expect(result).toHaveProperty('mime_type', 'application/pdf');
  });
});

describe('abortUpload', () => {
  it('DELETEs /api/files/uploads/{fileId}', async () => {
    mock.onDelete('/api/files/uploads/file-1').reply(204);

    await abortUpload('file-1');

    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.delete[0].url).toBe('/api/files/uploads/file-1');
  });
});
