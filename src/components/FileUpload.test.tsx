import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileUpload, { FileUploadProps } from './FileUpload';
import { uploadFile } from '../api/fileService';
import { IFile } from '../types';

jest.mock('../api/fileService');
const mockUploadFile = uploadFile as jest.MockedFunction<typeof uploadFile>;

const fakeFile: IFile = {
  id: 'file-1',
  user_id: 'u1',
  folder_id: null,
  name: 'test.txt',
  s3_key: 'uploads/test.txt',
  size_bytes: 1024,
  mime_type: 'text/plain',
  is_deleted: false,
  deleted_at: null,
  created_at: '2026-04-08T00:00:00Z',
  updated_at: '2026-04-08T00:00:00Z',
};

function renderComponent(overrides: Partial<FileUploadProps> = {}) {
  const props: FileUploadProps = {
    folderId: null,
    onUploaded: jest.fn(),
    ...overrides,
  };
  return { ...render(<FileUpload {...props} />), props };
}

function createTestFile(name = 'test.txt', type = 'text/plain') {
  return new File(['file content'], name, { type });
}

describe('FileUpload', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders the drop zone with browse link', () => {
    renderComponent();
    expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
    expect(screen.getByText('Browse')).toBeInTheDocument();
  });

  it('renders a hidden file input', () => {
    renderComponent();
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe('file');
  });

  it('selecting a file triggers upload and calls onUploaded on success', async () => {
    mockUploadFile.mockResolvedValue({ file: fakeFile });
    const { props } = renderComponent();

    const input = screen.getByTestId('file-input');
    const file = createTestFile();
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(mockUploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          file,
          onUploadProgress: expect.any(Function),
        }),
      );
    });

    await waitFor(() => {
      expect(props.onUploaded).toHaveBeenCalledWith(fakeFile);
    });
  });

  it('passes folderId to uploadFile when provided', async () => {
    mockUploadFile.mockResolvedValue({ file: { ...fakeFile, folder_id: 'folder-1' } });
    renderComponent({ folderId: 'folder-1' });

    const input = screen.getByTestId('file-input');
    await userEvent.upload(input, createTestFile());

    await waitFor(() => {
      expect(mockUploadFile).toHaveBeenCalledWith(
        expect.objectContaining({ folderId: 'folder-1' }),
      );
    });
  });

  it('shows progress bar during upload', async () => {
    let resolveUpload!: (value: { file: IFile }) => void;
    mockUploadFile.mockImplementation(({ onUploadProgress }) => {
      // Simulate progress
      if (onUploadProgress) {
        onUploadProgress({ loaded: 50, total: 100, bytes: 50 } as any);
      }
      return new Promise((resolve) => {
        resolveUpload = resolve;
      });
    });

    renderComponent();
    const input = screen.getByTestId('file-input');
    await userEvent.upload(input, createTestFile());

    expect(screen.getByText('test.txt')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    resolveUpload({ file: fakeFile });
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  it('shows "File is too large" on 413 error', async () => {
    const error413 = {
      response: { status: 413, data: { errorMsg: 'Payload too large' } },
    };
    mockUploadFile.mockRejectedValue(error413);
    renderComponent();

    const input = screen.getByTestId('file-input');
    await userEvent.upload(input, createTestFile());

    await waitFor(() => {
      expect(screen.getByText('File is too large')).toBeInTheDocument();
    });
  });

  it('shows API errorMsg on other errors', async () => {
    const error500 = {
      response: { status: 500, data: { errorMsg: 'Storage unavailable' } },
    };
    mockUploadFile.mockRejectedValue(error500);
    renderComponent();

    const input = screen.getByTestId('file-input');
    await userEvent.upload(input, createTestFile());

    await waitFor(() => {
      expect(screen.getByText('Storage unavailable')).toBeInTheDocument();
    });
  });

  it('shows generic error when no response data', async () => {
    mockUploadFile.mockRejectedValue(new Error('Network Error'));
    renderComponent();

    const input = screen.getByTestId('file-input');
    await userEvent.upload(input, createTestFile());

    await waitFor(() => {
      expect(screen.getByText('Network Error')).toBeInTheDocument();
    });
  });
});
