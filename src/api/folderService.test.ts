import MockAdapter from 'axios-mock-adapter';
import apiClient from './apiClient';
import {
  getRootFolders,
  createFolder,
  getFolder,
  renameFolder,
  deleteFolder,
  downloadFolder,
  restoreFolder,
  permanentDeleteFolder,
  shareFolder,
  unshareFolder,
  getFolderShares,
  CreateFolderPayload,
} from './folderService';
import { IFolder, IFile, ISharedUser } from '../types';

const mock = new MockAdapter(apiClient);

afterEach(() => {
  mock.reset();
});

const fakeFolder: IFolder = {
  id: 'f-1',
  user_id: 'u-1',
  parent_folder_id: null,
  name: 'My Folder',
  is_deleted: false,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

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

describe('getRootFolders', () => {
  it('GETs /api/folders and returns IFolder[]', async () => {
    const folders: IFolder[] = [fakeFolder];
    mock.onGet('/api/folders').reply(200, { folders });

    const result = await getRootFolders();

    expect(result).toEqual(folders);
    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].url).toBe('/api/folders');
  });
});

describe('createFolder', () => {
  it('POSTs to /api/folders with the correct payload', async () => {
    const payload: CreateFolderPayload = { name: 'New Folder' };
    mock.onPost('/api/folders').reply(201, { status: 'ok', error: false, data: fakeFolder });

    const result = await createFolder(payload);

    expect(result).toEqual(fakeFolder);
    expect(mock.history.post).toHaveLength(1);
    expect(JSON.parse(mock.history.post[0].data)).toEqual(payload);
  });

  it('POSTs with parentFolderId when provided', async () => {
    const payload: CreateFolderPayload = { name: 'Sub Folder', parentFolderId: 'f-1' };
    mock.onPost('/api/folders').reply(201, { status: 'ok', error: false, data: fakeFolder });

    await createFolder(payload);

    expect(JSON.parse(mock.history.post[0].data)).toEqual(payload);
  });
});

describe('getFolder', () => {
  it('GETs /api/folders/:id and returns folder with contents', async () => {
    const response = {
      folder: fakeFolder,
      subFolders: [],
      files: [fakeFile],
    };
    mock.onGet('/api/folders/f-1').reply(200, response);

    const result = await getFolder('f-1');

    expect(result).toEqual(response);
    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].url).toBe('/api/folders/f-1');
  });
});

describe('renameFolder', () => {
  it('PATCHes /api/folders/:id with the new name', async () => {
    const updated = { ...fakeFolder, name: 'Renamed' };
    mock.onPatch('/api/folders/f-1').reply(200, { status: 'ok', error: false, data: updated });

    const result = await renameFolder('f-1', 'Renamed');

    expect(result).toEqual(updated);
    expect(mock.history.patch).toHaveLength(1);
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ name: 'Renamed' });
  });
});

describe('deleteFolder', () => {
  it('DELETEs /api/folders/:id', async () => {
    mock.onDelete('/api/folders/f-1').reply(204);

    await deleteFolder('f-1');

    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.delete[0].url).toBe('/api/folders/f-1');
  });
});

describe('downloadFolder', () => {
  it('GETs /api/folders/:id/download with responseType blob', async () => {
    const fakeBlob = new Blob(['zip-content'], { type: 'application/zip' });
    mock.onGet('/api/folders/f-1/download').reply(200, fakeBlob);

    const result = await downloadFolder('f-1');

    expect(result).toEqual(fakeBlob);
    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].url).toBe('/api/folders/f-1/download');
    expect(mock.history.get[0].responseType).toBe('blob');
  });
});

describe('restoreFolder', () => {
  it('POSTs to /api/folders/:id/restore', async () => {
    const restored = { ...fakeFolder, is_deleted: false, deleted_at: null };
    mock.onPost('/api/folders/f-1/restore').reply(200, { status: 'ok', error: false, data: restored });

    const result = await restoreFolder('f-1');

    expect(result).toEqual(restored);
    expect(mock.history.post).toHaveLength(1);
    expect(mock.history.post[0].url).toBe('/api/folders/f-1/restore');
  });
});

describe('permanentDeleteFolder', () => {
  it('DELETEs /api/folders/:id/permanent', async () => {
    mock.onDelete('/api/folders/f-1/permanent').reply(204);

    await permanentDeleteFolder('f-1');

    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.delete[0].url).toBe('/api/folders/f-1/permanent');
  });
});

describe('shareFolder', () => {
  it('POSTs to /api/folders/:id/share with username', async () => {
    const response = { sharedWith: fakeSharedUser };
    mock.onPost('/api/folders/f-1/share').reply(200, response);

    const result = await shareFolder('f-1', 'janedoe');

    expect(result).toEqual(response);
    expect(mock.history.post).toHaveLength(1);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ username: 'janedoe' });
  });
});

describe('unshareFolder', () => {
  it('DELETEs /api/folders/:id/share/:sharedUserId', async () => {
    mock.onDelete('/api/folders/f-1/share/u-2').reply(204);

    await unshareFolder('f-1', 'u-2');

    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.delete[0].url).toBe('/api/folders/f-1/share/u-2');
  });
});

describe('getFolderShares', () => {
  it('GETs /api/folders/:id/shares and returns shared users', async () => {
    const response = { sharedWith: [fakeSharedUser] };
    mock.onGet('/api/folders/f-1/shares').reply(200, response);

    const result = await getFolderShares('f-1');

    expect(result).toEqual(response);
    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].url).toBe('/api/folders/f-1/shares');
  });
});
