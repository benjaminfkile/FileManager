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
  moveFile,
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

// Mock XMLHttpRequest for S3 upload tests
function createMockXHR() {
  const xhr = {
    status: 200,
    upload: { onprogress: null as null | ((e: Partial<ProgressEvent>) => void) },
    onload: null as null | (() => void),
    onerror: null as null | (() => void),
    open: jest.fn(),
    setRequestHeader: jest.fn(),
    send: jest.fn().mockImplementation(() => {
      if (xhr.onload) xhr.onload();
    }),
  };
  return xhr;
}

type MockXHR = ReturnType<typeof createMockXHR>;
let mockXHRInstance: MockXHR;
beforeEach(() => {
  mockXHRInstance = createMockXHR();
  jest.spyOn(window, 'XMLHttpRequest').mockImplementation(() => mockXHRInstance as unknown as XMLHttpRequest);
});

const presignResponse = {
  presignedUrl: 'https://s3.example.com/presigned-put',
  s3Key: 'uploads/abc123/hello.txt',
  fileId: 'file-new-1',
};

describe('uploadFile', () => {
  it('uses presign → XHR PUT → register three-step flow', async () => {
    mock.onGet('/api/files/presign-upload').reply(200, presignResponse);
    mock.onPost('/api/files/register').reply(201, { file: fakeFile });

    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    const result = await uploadFile({ file });

    expect(result).toEqual({ file: fakeFile });

    // Step 1: presign request
    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].url).toBe('/api/files/presign-upload');
    expect(mock.history.get[0].params).toEqual({
      name: 'hello.txt',
      mimeType: 'text/plain',
      sizeBytes: 5,
      folderId: undefined,
    });

    // Step 2: XHR PUT to S3
    expect(mockXHRInstance.open).toHaveBeenCalledWith('PUT', presignResponse.presignedUrl);
    expect(mockXHRInstance.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'text/plain');
    expect(mockXHRInstance.send).toHaveBeenCalledWith(file);

    // Step 3: register
    expect(mock.history.post).toHaveLength(1);
    expect(mock.history.post[0].url).toBe('/api/files/register');
    const registerBody = JSON.parse(mock.history.post[0].data);
    expect(registerBody).toEqual({
      fileId: presignResponse.fileId,
      name: 'hello.txt',
      s3Key: presignResponse.s3Key,
      sizeBytes: 5,
      mimeType: 'text/plain',
      folderId: null,
    });
  });

  it('includes folderId and custom name when provided', async () => {
    mock.onGet('/api/files/presign-upload').reply(200, presignResponse);
    mock.onPost('/api/files/register').reply(201, { file: fakeFile });

    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    await uploadFile({ file, folderId: 'f-1', name: 'custom.txt' });

    expect(mock.history.get[0].params.folderId).toBe('f-1');

    const registerBody = JSON.parse(mock.history.post[0].data);
    expect(registerBody.name).toBe('custom.txt');
    expect(registerBody.folderId).toBe('f-1');
  });

  it('fires onUploadProgress via XHR upload.onprogress', async () => {
    mock.onGet('/api/files/presign-upload').reply(200, presignResponse);
    mock.onPost('/api/files/register').reply(201, { file: fakeFile });

    mockXHRInstance.send = jest.fn().mockImplementation(() => {
      // Simulate a progress event before completing
      if (mockXHRInstance.upload.onprogress) {
        mockXHRInstance.upload.onprogress({ lengthComputable: true, loaded: 3, total: 5 });
      }
      if (mockXHRInstance.onload) mockXHRInstance.onload();
    });

    const onUploadProgress = jest.fn();
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    await uploadFile({ file, onUploadProgress });

    expect(onUploadProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        loaded: 3,
        total: 5,
        progress: 3 / 5,
        bytes: 3,
        upload: true,
        download: false,
      }),
    );
  });

  it('rejects with descriptive error on S3 PUT failure (non-2xx)', async () => {
    mock.onGet('/api/files/presign-upload').reply(200, presignResponse);

    mockXHRInstance.status = 403;
    mockXHRInstance.send = jest.fn().mockImplementation(() => {
      if (mockXHRInstance.onload) mockXHRInstance.onload();
    });

    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    await expect(uploadFile({ file })).rejects.toThrow('S3 upload failed: 403');
  });

  it('rejects with network error on XHR onerror', async () => {
    mock.onGet('/api/files/presign-upload').reply(200, presignResponse);

    mockXHRInstance.send = jest.fn().mockImplementation(() => {
      if (mockXHRInstance.onerror) mockXHRInstance.onerror();
    });

    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    await expect(uploadFile({ file })).rejects.toThrow('Upload failed — network error');
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

describe('moveFile', () => {
  it('PATCHes /api/files/:id/move with folderId and returns the IFile', async () => {
    mock.onPatch('/api/files/file-1/move').reply(200, { file: fakeFile });

    const result = await moveFile('file-1', 'folder-1');

    expect(result).toEqual(fakeFile);
    expect(mock.history.patch).toHaveLength(1);
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ folderId: 'folder-1' });
  });

  it('PATCHes with folderId null to move to root', async () => {
    mock.onPatch('/api/files/file-1/move').reply(200, { file: fakeFile });

    const result = await moveFile('file-1', null);

    expect(result).toEqual(fakeFile);
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ folderId: null });
  });
});
