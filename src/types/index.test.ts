import type {
  IUser,
  IFolder,
  IFile,
  IFileShare,
  IFolderShare,
  ISharedUser,
  IRecycleBinItem,
} from './index';

describe('types', () => {
  it('IUser', () => {
    const user: IUser = {
      id: '1',
      first_name: 'John',
      last_name: 'Doe',
      username: 'johndoe',
      created_at: '2026-01-01T00:00:00Z',
    };
    expect(user).toBeDefined();
  });

  it('IUser with optional updated_at', () => {
    const user: IUser = {
      id: '1',
      first_name: 'John',
      last_name: 'Doe',
      username: 'johndoe',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    };
    expect(user).toBeDefined();
  });

  it('IFolder', () => {
    const folder: IFolder = {
      id: '1',
      user_id: '1',
      parent_folder_id: null,
      name: 'Documents',
      is_deleted: false,
      deleted_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    expect(folder).toBeDefined();
  });

  it('IFile', () => {
    const file: IFile = {
      id: '1',
      user_id: '1',
      folder_id: null,
      name: 'readme.txt',
      s3_key: 'uploads/readme.txt',
      size_bytes: 1024,
      mime_type: 'text/plain',
      is_deleted: false,
      deleted_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    expect(file).toBeDefined();
  });

  it('IFileShare', () => {
    const share: IFileShare = {
      id: '1',
      file_id: '1',
      owner_user_id: '1',
      shared_with_user_id: '2',
      created_at: '2026-01-01T00:00:00Z',
    };
    expect(share).toBeDefined();
  });

  it('IFolderShare', () => {
    const share: IFolderShare = {
      id: '1',
      folder_id: '1',
      owner_user_id: '1',
      shared_with_user_id: '2',
      created_at: '2026-01-01T00:00:00Z',
    };
    expect(share).toBeDefined();
  });

  it('ISharedUser', () => {
    const sharedUser: ISharedUser = {
      id: '1',
      username: 'janedoe',
      first_name: 'Jane',
      last_name: 'Doe',
    };
    expect(sharedUser).toBeDefined();
  });

  it('ISharedUser with optional sharedAt', () => {
    const sharedUser: ISharedUser = {
      id: '1',
      username: 'janedoe',
      first_name: 'Jane',
      last_name: 'Doe',
      sharedAt: '2026-01-01T00:00:00Z',
    };
    expect(sharedUser).toBeDefined();
  });

  it('IRecycleBinItem', () => {
    const bin: IRecycleBinItem = {
      folders: [],
      files: [],
    };
    expect(bin).toBeDefined();
  });
});
