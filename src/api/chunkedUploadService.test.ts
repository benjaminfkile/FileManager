import MockAdapter from 'axios-mock-adapter';
import apiClient from './apiClient';
import {
  initiateUpload,
  uploadPart,
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

describe('uploadPart', () => {
  it('PUTs to /api/files/uploads/{fileId}/parts/{partNumber} with Content-Type: application/octet-stream', async () => {
    const response = { partNumber: 1, etag: '"abc123"' };
    mock.onPut('/api/files/uploads/file-1/parts/1').reply(200, response);

    const buf = Buffer.from('hello world');
    const chunk = new Blob([buf], { type: 'application/octet-stream' });
    (chunk as any).arrayBuffer = () => Promise.resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const result = await uploadPart({ fileId: 'file-1', partNumber: 1, chunk });

    expect(result).toEqual(response);
    expect(mock.history.put).toHaveLength(1);
    expect(mock.history.put[0].url).toBe('/api/files/uploads/file-1/parts/1');
    expect(mock.history.put[0].headers?.['Content-Type']).toBe('application/octet-stream');
  });

  it('returns { partNumber, etag }', async () => {
    const response = { partNumber: 3, etag: '"def456"' };
    mock.onPut('/api/files/uploads/file-1/parts/3').reply(200, response);

    const buf = Buffer.from('data');
    const chunk = new Blob([buf], { type: 'application/octet-stream' });
    (chunk as any).arrayBuffer = () => Promise.resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const result = await uploadPart({ fileId: 'file-1', partNumber: 3, chunk });

    expect(result).toHaveProperty('partNumber', 3);
    expect(result).toHaveProperty('etag', '"def456"');
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
