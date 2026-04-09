import MockAdapter from 'axios-mock-adapter';
import apiClient from './apiClient';
import {
  uploadFile,
  downloadFile,
  previewFile,
  renameFile,
  deleteFile,
  restoreFile,
  permanentDeleteFile,
  shareFile,
  unshareFile,
  getFileShares,
} from './fileService';
import { IFile, ISharedUser } from '../types';

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

const fakeSharedUser: ISharedUser = {
  id: 'u-2',
  username: 'janedoe',
  first_name: 'Jane',
  last_name: 'Doe',
  sharedAt: '2026-01-02T00:00:00.000Z',
};

describe('uploadFile', () => {
  it('POSTs multipart/form-data to /api/files/upload', async () => {
    const response = { file: fakeFile };
    mock.onPost('/api/files/upload').reply(201, response);

    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    const result = await uploadFile({ file });

    expect(result).toEqual(response);
    expect(mock.history.post).toHaveLength(1);
    expect(mock.history.post[0].url).toBe('/api/files/upload');
    expect(mock.history.post[0].data).toBeInstanceOf(FormData);
    expect(mock.history.post[0].headers?.['Content-Type']).toBe('multipart/form-data');
  });

  it('includes folderId and name in FormData when provided', async () => {
    const response = { file: fakeFile };
    mock.onPost('/api/files/upload').reply(201, response);

    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    await uploadFile({ file, folderId: 'f-1', name: 'custom.txt' });

    const formData = mock.history.post[0].data as FormData;
    expect(formData.get('folderId')).toBe('f-1');
    expect(formData.get('name')).toBe('custom.txt');
  });

  it('passes onUploadProgress callback', async () => {
    mock.onPost('/api/files/upload').reply(201, { file: fakeFile });

    const onUploadProgress = jest.fn();
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    await uploadFile({ file, onUploadProgress });

    expect(mock.history.post[0].onUploadProgress).toBe(onUploadProgress);
  });
});

describe('downloadFile', () => {
  it('GETs /api/files/:id/download with responseType blob and returns a Blob', async () => {
    const fakeBlob = new Blob(['file bytes'], { type: 'image/png' });
    mock.onGet('/api/files/file-1/download').reply(200, fakeBlob);

    const result = await downloadFile('file-1');

    expect(result).toBeInstanceOf(Blob);
    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].url).toBe('/api/files/file-1/download');
    expect(mock.history.get[0].responseType).toBe('blob');
  });
});

describe('previewFile', () => {
  it('GETs /api/files/:id/preview and returns url, mimeType, expiresAt', async () => {
    const response = {
      url: 'https://cdn.example.com/preview-url',
      mimeType: 'application/pdf',
      expiresAt: '2026-01-01T01:00:00.000Z',
    };
    mock.onGet('/api/files/file-1/preview').reply(200, response);

    const result = await previewFile('file-1');

    expect(result).toEqual(response);
    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].url).toBe('/api/files/file-1/preview');
  });
});

describe('renameFile', () => {
  it('PATCHes /api/files/:id with the new name', async () => {
    const updated = { ...fakeFile, name: 'renamed.pdf' };
    mock.onPatch('/api/files/file-1').reply(200, { status: 'ok', error: false, data: updated });

    const result = await renameFile('file-1', 'renamed.pdf');

    expect(result).toEqual(updated);
    expect(mock.history.patch).toHaveLength(1);
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ name: 'renamed.pdf' });
  });
});

describe('deleteFile', () => {
  it('DELETEs /api/files/:id', async () => {
    mock.onDelete('/api/files/file-1').reply(204);

    await deleteFile('file-1');

    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.delete[0].url).toBe('/api/files/file-1');
  });
});

describe('restoreFile', () => {
  it('POSTs to /api/files/:id/restore', async () => {
    const restored = { ...fakeFile, is_deleted: false, deleted_at: null };
    mock.onPost('/api/files/file-1/restore').reply(200, { status: 'ok', error: false, data: restored });

    const result = await restoreFile('file-1');

    expect(result).toEqual(restored);
    expect(mock.history.post).toHaveLength(1);
    expect(mock.history.post[0].url).toBe('/api/files/file-1/restore');
  });
});

describe('permanentDeleteFile', () => {
  it('DELETEs /api/files/:id/permanent', async () => {
    mock.onDelete('/api/files/file-1/permanent').reply(204);

    await permanentDeleteFile('file-1');

    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.delete[0].url).toBe('/api/files/file-1/permanent');
  });
});

describe('shareFile', () => {
  it('POSTs to /api/files/:id/share with username', async () => {
    const response = { sharedWith: fakeSharedUser };
    mock.onPost('/api/files/file-1/share').reply(200, response);

    const result = await shareFile('file-1', 'janedoe');

    expect(result).toEqual(response);
    expect(mock.history.post).toHaveLength(1);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ username: 'janedoe' });
  });
});

describe('unshareFile', () => {
  it('DELETEs /api/files/:id/share/:sharedUserId', async () => {
    mock.onDelete('/api/files/file-1/share/u-2').reply(204);

    await unshareFile('file-1', 'u-2');

    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.delete[0].url).toBe('/api/files/file-1/share/u-2');
  });
});

describe('getFileShares', () => {
  it('GETs /api/files/:id/shares and returns shared users', async () => {
    const response = { sharedWith: [fakeSharedUser] };
    mock.onGet('/api/files/file-1/shares').reply(200, response);

    const result = await getFileShares('file-1');

    expect(result).toEqual(response);
    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].url).toBe('/api/files/file-1/shares');
  });
});
