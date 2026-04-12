export interface IUser {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  created_at: string;
  updated_at?: string;
}

export interface IFolder {
  id: string;
  user_id: string;
  parent_folder_id: string | null;
  name: string;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IFile {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  s3_key: string;
  size_bytes: number;
  mime_type: string;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IFileShare {
  id: string;
  file_id: string;
  owner_user_id: string;
  shared_with_user_id: string;
  created_at: string;
}

export interface IFolderShare {
  id: string;
  folder_id: string;
  owner_user_id: string;
  shared_with_user_id: string;
  created_at: string;
}

export interface IShareLink {
  id: string;
  token: string;
  file_id: string | null;
  folder_id: string | null;
  created_by_user_id: string;
  expires_at: string | null;
  created_at: string;
}

/** Response from GET /api/links/:token */
export interface IShareLinkResolution {
  type: 'file' | 'folder';
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  downloadUrl: string | null;
}

export interface ISharedUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  sharedAt?: string;
}

export interface IRecycleBinItem {
  folders: IFolder[];
  files: IFile[];
}
