import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileUpload, { FileUploadProps, MAX_FILE_SIZE_BYTES } from './FileUpload';
import { IFile } from '../types';

jest.mock('../hooks/useChunkedUpload', () => ({
  useChunkedUpload: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useChunkedUpload: mockUseChunkedUpload } = require('../hooks/useChunkedUpload') as { useChunkedUpload: jest.Mock };

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

type MockHookOverrides = Partial<{
  upload: jest.Mock;
  resume: jest.Mock;
  discardResume: jest.Mock;
  abort: jest.Mock;
  progress: number;
  isUploading: boolean;
  error: string | null;
  pendingResume: { fileId: string; alreadyUploaded: number } | null;
}>;

function createMockHook(overrides: MockHookOverrides = {}) {
  return {
    upload: jest.fn<Promise<IFile | null>, [any]>().mockResolvedValue(fakeFile),
    resume: jest.fn<Promise<IFile>, []>().mockResolvedValue(fakeFile),
    discardResume: jest.fn(),
    abort: jest.fn(),
    progress: 0,
    isUploading: false,
    error: null,
    pendingResume: null,
    ...overrides,
  };
}

function renderComponent(overrides: Partial<FileUploadProps> = {}) {
  const props: FileUploadProps = {
    folderId: null,
    onUploaded: jest.fn(),
    ...overrides,
  };
  return { ...render(<FileUpload {...props} />), props };
}

function createTestFile(name = 'test.txt', type = 'text/plain', size?: number) {
  const file = new File(['file content'], name, { type });
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size });
  }
  return file;
}

describe('FileUpload', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockUseChunkedUpload.mockReturnValue(createMockHook());
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
    const mockHook = createMockHook();
    mockUseChunkedUpload.mockReturnValue(mockHook);
    const { props } = renderComponent();

    const input = screen.getByTestId('file-input');
    const file = createTestFile();
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(mockHook.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          file,
        }),
      );
    });

    await waitFor(() => {
      expect(props.onUploaded).toHaveBeenCalledWith(fakeFile);
    });
  });

  it('passes folderId to upload when provided', async () => {
    const mockHook = createMockHook();
    mockUseChunkedUpload.mockReturnValue(mockHook);
    renderComponent({ folderId: 'folder-1' });

    const input = screen.getByTestId('file-input');
    await userEvent.upload(input, createTestFile());

    await waitFor(() => {
      expect(mockHook.upload).toHaveBeenCalledWith(
        expect.objectContaining({ folderId: 'folder-1' }),
      );
    });
  });

  it('shows progress bar during upload', async () => {
    const mockHook = createMockHook({ isUploading: true, progress: 50 });
    mockUseChunkedUpload.mockReturnValue(mockHook);

    let resolveUpload!: (value: IFile) => void;
    mockHook.upload.mockImplementation(() => {
      return new Promise((resolve) => {
        resolveUpload = resolve;
      });
    });

    renderComponent();
    const input = screen.getByTestId('file-input');
    await userEvent.upload(input, createTestFile());

    expect(screen.getByText('test.txt')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // Simulate upload completing by re-rendering with updated hook state
    mockUseChunkedUpload.mockReturnValue(createMockHook({ isUploading: false, progress: 100 }));
    resolveUpload(fakeFile);

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  it('shows error from the hook', async () => {
    mockUseChunkedUpload.mockReturnValue(createMockHook({ error: 'Upload failed' }));
    renderComponent();

    expect(screen.getByText('Upload failed')).toBeInTheDocument();
  });

  it('shows hook error when upload rejects', async () => {
    const mockHook = createMockHook({ error: 'Storage unavailable' });
    mockHook.upload.mockRejectedValue(new Error('Storage unavailable'));
    mockUseChunkedUpload.mockReturnValue(mockHook);
    renderComponent();

    const input = screen.getByTestId('file-input');
    await userEvent.upload(input, createTestFile());

    await waitFor(() => {
      expect(screen.getByText('Storage unavailable')).toBeInTheDocument();
    });
  });

  it('shows size error when file exceeds MAX_FILE_SIZE_BYTES and does not call upload', async () => {
    const mockHook = createMockHook();
    mockUseChunkedUpload.mockReturnValue(mockHook);
    renderComponent();

    const input = screen.getByTestId('file-input');
    const oversizedFile = createTestFile('huge.bin', 'application/octet-stream', MAX_FILE_SIZE_BYTES + 1);
    await userEvent.upload(input, oversizedFile);

    await waitFor(() => {
      expect(
        screen.getByText('File exceeds the maximum upload size of 5 TB'),
      ).toBeInTheDocument();
    });

    expect(mockHook.upload).not.toHaveBeenCalled();
  });

  describe('resume prompt', () => {
    it('renders the resume dialog when pendingResume is set', () => {
      mockUseChunkedUpload.mockReturnValue(
        createMockHook({
          pendingResume: { fileId: 'file-1', alreadyUploaded: 3 },
        }),
      );
      renderComponent();
      expect(screen.getByTestId('resume-upload-dialog')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: /resume previous upload/i }),
      ).toBeInTheDocument();
      expect(screen.getByTestId('resume-confirm')).toBeInTheDocument();
      expect(screen.getByTestId('resume-start-over')).toBeInTheDocument();
    });

    it('shows the dialog before any progress bar is rendered', async () => {
      const mockHook = createMockHook({
        pendingResume: { fileId: 'file-1', alreadyUploaded: 1 },
        isUploading: false,
      });
      mockHook.upload.mockResolvedValue(null);
      mockUseChunkedUpload.mockReturnValue(mockHook);

      renderComponent();
      const input = screen.getByTestId('file-input');
      await userEvent.upload(input, createTestFile());

      await waitFor(() => {
        expect(screen.getByTestId('resume-upload-dialog')).toBeInTheDocument();
      });
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('clicking Resume calls hook.resume() and reports the uploaded file', async () => {
      const mockHook = createMockHook({
        pendingResume: { fileId: 'file-1', alreadyUploaded: 2 },
      });
      mockUseChunkedUpload.mockReturnValue(mockHook);
      const { props } = renderComponent();

      const resumeBtn = screen.getByTestId('resume-confirm');
      await userEvent.click(resumeBtn);

      expect(mockHook.resume).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(props.onUploaded).toHaveBeenCalledWith(fakeFile);
      });
      expect(mockHook.discardResume).not.toHaveBeenCalled();
    });

    it('clicking Start over calls discardResume() then upload()', async () => {
      const mockHook = createMockHook({
        pendingResume: { fileId: 'file-1', alreadyUploaded: 2 },
      });
      mockUseChunkedUpload.mockReturnValue(mockHook);
      renderComponent();

      // First, the user picks the file — that triggers the initial upload() call
      // which the hook short-circuits with pendingResume.
      mockHook.upload.mockResolvedValueOnce(null);
      const input = screen.getByTestId('file-input');
      await userEvent.upload(input, createTestFile());

      const initialUploadCalls = mockHook.upload.mock.calls.length;

      const startOverBtn = screen.getByTestId('resume-start-over');
      await userEvent.click(startOverBtn);

      expect(mockHook.discardResume).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(mockHook.upload.mock.calls.length).toBeGreaterThan(initialUploadCalls);
      });
      expect(mockHook.resume).not.toHaveBeenCalled();
    });
  });
});
