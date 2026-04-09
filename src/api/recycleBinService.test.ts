import MockAdapter from 'axios-mock-adapter';
import apiClient from './apiClient';
import {
  getRecycleBin,
  restoreAll,
  emptyRecycleBin,
} from './recycleBinService';
import { IFolder, IFile } from '../types';

const mock = new MockAdapter(apiClient);

afterEach(() => {
  mock.reset();
});

const fakeFolder: IFolder = {
  id: 'f-1',
  user_id: 'u-1',
  parent_folder_id: null,
  name: 'Deleted Folder',
  is_deleted: true,
  deleted_at: '2026-01-05T00:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const fakeFile: IFile = {
  id: 'file-1',
  user_id: 'u-1',
  folder_id: 'f-1',
  name: 'deleted-document.pdf',
  s3_key: 'uploads/deleted-document.pdf',
  size_bytes: 2048,
  mime_type: 'application/pdf',
  is_deleted: true,
  deleted_at: '2026-01-05T00:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('getRecycleBin', () => {
  it('GETs /api/recycle-bin and returns folders and files', async () => {
    const response = { folders: [fakeFolder], files: [fakeFile] };
    mock.onGet('/api/recycle-bin').reply(200, response);

    const result = await getRecycleBin();

    expect(result).toEqual(response);
    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].url).toBe('/api/recycle-bin');
  });
});

describe('restoreAll', () => {
  it('POSTs to /api/recycle-bin/restore-all and returns restored counts', async () => {
    const response = { restoredFolders: 1, restoredFiles: 2 };
    mock.onPost('/api/recycle-bin/restore-all').reply(200, response);

    const result = await restoreAll();

    expect(result).toEqual(response);
    expect(mock.history.post).toHaveLength(1);
    expect(mock.history.post[0].url).toBe('/api/recycle-bin/restore-all');
  });
});

describe('emptyRecycleBin', () => {
  it('DELETEs /api/recycle-bin/empty', async () => {
    mock.onDelete('/api/recycle-bin/empty').reply(204);

    await emptyRecycleBin();

    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.delete[0].url).toBe('/api/recycle-bin/empty');
  });
});
