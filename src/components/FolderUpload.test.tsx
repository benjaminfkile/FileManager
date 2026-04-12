import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FolderUpload, { FolderUploadProps } from './FolderUpload';
import { uploadFile } from '../api/fileService';
import { createFolder } from '../api/folderService';
import { IFile, IFolder } from '../types';

jest.mock('../api/fileService');
jest.mock('../api/folderService');

// jsdom doesn't have webkitdirectory — polyfill so the component renders the full UI
beforeAll(() => {
  if (!('webkitdirectory' in HTMLInputElement.prototype)) {
    Object.defineProperty(HTMLInputElement.prototype, 'webkitdirectory', {
      value: false,
      writable: true,
      configurable: true,
    });
  }
});

const mockUploadFile = uploadFile as jest.MockedFunction<typeof uploadFile>;
const mockCreateFolder = createFolder as jest.MockedFunction<typeof createFolder>;

function makeFakeFile(name: string, relativePath: string): File {
  const file = new File(['content'], name, { type: 'text/plain' });
  Object.defineProperty(file, 'webkitRelativePath', {
    value: relativePath,
    writable: false,
  });
  return file;
}

function makeFakeFolder(id: string, name: string): IFolder {
  return {
    id,
    user_id: 'u1',
    parent_folder_id: null,
    name,
    is_deleted: false,
    deleted_at: null,
    created_at: '2026-04-11T00:00:00Z',
    updated_at: '2026-04-11T00:00:00Z',
  };
}

function makeFakeIFile(id: string, name: string): IFile {
  return {
    id,
    user_id: 'u1',
    folder_id: null,
    name,
    s3_key: `uploads/${name}`,
    size_bytes: 7,
    mime_type: 'text/plain',
    is_deleted: false,
    deleted_at: null,
    created_at: '2026-04-11T00:00:00Z',
    updated_at: '2026-04-11T00:00:00Z',
  };
}

function renderComponent(overrides: Partial<FolderUploadProps> = {}) {
  const props: FolderUploadProps = {
    folderId: null,
    onComplete: jest.fn(),
    ...overrides,
  };
  return { ...render(<FolderUpload {...props} />), props };
}

describe('FolderUpload', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders drop zone', () => {
    renderComponent();
    expect(screen.getByTestId('folder-drop-zone')).toBeInTheDocument();
    expect(screen.getByText('Browse')).toBeInTheDocument();
  });

  it('selecting files via input triggers folder creation and file upload calls in the correct order', async () => {
    // Folder structure: photos/vacation/beach.jpg, photos/cat.png
    const files = [
      makeFakeFile('beach.jpg', 'photos/vacation/beach.jpg'),
      makeFakeFile('cat.png', 'photos/cat.png'),
    ];

    mockCreateFolder
      .mockResolvedValueOnce(makeFakeFolder('folder-photos', 'photos'))
      .mockResolvedValueOnce(makeFakeFolder('folder-vacation', 'vacation'));

    mockUploadFile
      .mockResolvedValueOnce({ file: makeFakeIFile('f1', 'beach.jpg') })
      .mockResolvedValueOnce({ file: makeFakeIFile('f2', 'cat.png') });

    const { props } = renderComponent();

    const input = screen.getByTestId('folder-input');

    // Simulate file selection with webkitRelativePath
    await act(async () => {
      Object.defineProperty(input, 'files', { value: files, configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await waitFor(() => {
      // Folders should be created shallow-first: photos then photos/vacation
      expect(mockCreateFolder).toHaveBeenCalledTimes(2);
      expect(mockCreateFolder).toHaveBeenNthCalledWith(1, {
        name: 'photos',
        parentFolderId: undefined,
      });
      expect(mockCreateFolder).toHaveBeenNthCalledWith(2, {
        name: 'vacation',
        parentFolderId: 'folder-photos',
      });
    });

    await waitFor(() => {
      expect(mockUploadFile).toHaveBeenCalledTimes(2);
      // beach.jpg goes into folder-vacation
      expect(mockUploadFile).toHaveBeenCalledWith(
        expect.objectContaining({ folderId: 'folder-vacation' }),
      );
      // cat.png goes into folder-photos
      expect(mockUploadFile).toHaveBeenCalledWith(
        expect.objectContaining({ folderId: 'folder-photos' }),
      );
    });

    await waitFor(() => {
      expect(props.onComplete).toHaveBeenCalledWith(2);
    });
  });

  it('displays per-file progress', async () => {
    const files = [makeFakeFile('a.txt', 'mydir/a.txt')];

    mockCreateFolder.mockResolvedValueOnce(makeFakeFolder('folder-mydir', 'mydir'));

    let resolveUpload!: (value: { file: IFile }) => void;
    mockUploadFile.mockImplementation(({ onUploadProgress }) => {
      if (onUploadProgress) {
        onUploadProgress({ loaded: 50, total: 100, bytes: 50 } as any);
      }
      return new Promise((resolve) => {
        resolveUpload = resolve;
      });
    });

    renderComponent();
    const input = screen.getByTestId('folder-input');

    await act(async () => {
      Object.defineProperty(input, 'files', { value: files, configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Wait for the progress bar to appear
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    expect(screen.getByText(/Uploading a\.txt/)).toBeInTheDocument();

    // Resolve the upload
    await act(async () => {
      resolveUpload({ file: makeFakeIFile('f1', 'a.txt') });
    });

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  it('displays overall file count', async () => {
    const files = [
      makeFakeFile('a.txt', 'dir/a.txt'),
      makeFakeFile('b.txt', 'dir/b.txt'),
    ];

    mockCreateFolder.mockResolvedValueOnce(makeFakeFolder('folder-dir', 'dir'));

    let resolveFirst!: (value: { file: IFile }) => void;
    let uploadCallCount = 0;

    mockUploadFile.mockImplementation(() => {
      uploadCallCount++;
      if (uploadCallCount === 1) {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve({ file: makeFakeIFile('f2', 'b.txt') });
    });

    renderComponent();
    const input = screen.getByTestId('folder-input');

    await act(async () => {
      Object.defineProperty(input, 'files', { value: files, configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Should show "1 of 2" while first file uploads
    await waitFor(() => {
      expect(screen.getByText(/1 of 2/)).toBeInTheDocument();
      expect(screen.getByText(/1 \/ 2 files/)).toBeInTheDocument();
    });

    await act(async () => {
      resolveFirst({ file: makeFakeIFile('f1', 'a.txt') });
    });

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  it('shows error summary when an individual file upload fails, and continues remaining uploads', async () => {
    const files = [
      makeFakeFile('fail.txt', 'dir/fail.txt'),
      makeFakeFile('ok.txt', 'dir/ok.txt'),
    ];

    mockCreateFolder.mockResolvedValueOnce(makeFakeFolder('folder-dir', 'dir'));
    mockUploadFile
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce({ file: makeFakeIFile('f2', 'ok.txt') });

    const { props } = renderComponent();
    const input = screen.getByTestId('folder-input');

    await act(async () => {
      Object.defineProperty(input, 'files', { value: files, configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await waitFor(() => {
      // Error is displayed
      expect(screen.getByText(/1 error occurred/)).toBeInTheDocument();
      expect(screen.getByText(/fail\.txt: Network Error/)).toBeInTheDocument();
    });

    // Both files were attempted
    expect(mockUploadFile).toHaveBeenCalledTimes(2);
    // onComplete is called with success count (1 out of 2)
    expect(props.onComplete).toHaveBeenCalledWith(1);
  });

  it('calls onComplete with the correct file count on full success', async () => {
    const files = [
      makeFakeFile('a.txt', 'stuff/a.txt'),
      makeFakeFile('b.txt', 'stuff/b.txt'),
      makeFakeFile('c.txt', 'stuff/c.txt'),
    ];

    mockCreateFolder.mockResolvedValueOnce(makeFakeFolder('folder-stuff', 'stuff'));
    mockUploadFile
      .mockResolvedValueOnce({ file: makeFakeIFile('f1', 'a.txt') })
      .mockResolvedValueOnce({ file: makeFakeIFile('f2', 'b.txt') })
      .mockResolvedValueOnce({ file: makeFakeIFile('f3', 'c.txt') });

    const { props } = renderComponent();
    const input = screen.getByTestId('folder-input');

    await act(async () => {
      Object.defineProperty(input, 'files', { value: files, configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await waitFor(() => {
      expect(props.onComplete).toHaveBeenCalledWith(3);
    });
  });
});
