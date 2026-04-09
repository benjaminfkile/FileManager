import MockAdapter from 'axios-mock-adapter';
import apiClient from './apiClient';
import { getSharedWithMe } from './sharedService';
import { IFolder, IFile } from '../types';

const mock = new MockAdapter(apiClient);

afterEach(() => {
  mock.reset();
});

const fakeFolder: IFolder = {
  id: 'f-1',
  user_id: 'u-2',
  parent_folder_id: null,
  name: 'Shared Folder',
  is_deleted: false,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const fakeFile: IFile = {
  id: 'file-1',
  user_id: 'u-2',
  folder_id: 'f-1',
  name: 'shared-document.pdf',
  s3_key: 'uploads/shared-document.pdf',
  size_bytes: 1024,
  mime_type: 'application/pdf',
  is_deleted: false,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('getSharedWithMe', () => {
  it('GETs /api/shared and returns files and folders', async () => {
    const response = { files: [fakeFile], folders: [fakeFolder] };
    mock.onGet('/api/shared').reply(200, response);

    const result = await getSharedWithMe();

    expect(result).toEqual(response);
    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].url).toBe('/api/shared');
  });
});
