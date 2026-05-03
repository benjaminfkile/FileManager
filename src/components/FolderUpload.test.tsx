import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FolderUpload, { FolderUploadProps } from './FolderUpload';

jest.mock('../api/chunkedUploadService', () => ({
  initiateUpload: jest.fn(),
  getPartUrls: jest.fn(),
  uploadPartToUrl: jest.fn(),
  completeUpload: jest.fn(),
  abortUpload: jest.fn(),
}));

jest.mock('../utils/chunkFile', () => ({
  chunkFile: jest.fn(),
}));

jest.mock('../api/folderService', () => ({
  createFolder: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  initiateUpload,
  getPartUrls,
  uploadPartToUrl,
  completeUpload,
  abortUpload,
} = require('../api/chunkedUploadService') as {
  initiateUpload: jest.Mock;
  getPartUrls: jest.Mock;
  uploadPartToUrl: jest.Mock;
  completeUpload: jest.Mock;
  abortUpload: jest.Mock;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chunkFile } = require('../utils/chunkFile') as { chunkFile: jest.Mock };

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createFolder } = require('../api/folderService') as { createFolder: jest.Mock };

function renderComponent(overrides: Partial<FolderUploadProps> = {}) {
  const props: FolderUploadProps = {
    folderId: null,
    onCompleted: jest.fn(),
    ...overrides,
  };
  return { ...render(<FolderUpload {...props} />), props };
}

function createTestFile(name = 'test.txt', type = 'text/plain', size = 1024) {
  const file = new File(['file content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function setupChunkedMocks(fileId = 'file-1') {
  initiateUpload.mockResolvedValue({ uploadId: 'upload-1', fileId, key: 'key-1' });
  chunkFile.mockReturnValue([
    { blob: new Blob(['chunk1']), partNumber: 1, start: 0, end: 512 },
    { blob: new Blob(['chunk2']), partNumber: 2, start: 512, end: 1024 },
  ]);
  getPartUrls.mockImplementation((_fileId: string, partNumbers: number[]) =>
    Promise.resolve(
      partNumbers.map((p) => ({ partNumber: p, url: `https://s3.example/put?p=${p}` })),
    ),
  );
  uploadPartToUrl.mockImplementation(({ partNumber }: { partNumber: number }) =>
    Promise.resolve({ partNumber, etag: `etag-${partNumber}` }),
  );
  completeUpload.mockResolvedValue({
    id: fileId,
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
  });
  abortUpload.mockResolvedValue(undefined);
}

describe('FolderUpload', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    createFolder.mockResolvedValue({ id: 'folder-new' });
  });

  it('renders the folder drop zone', () => {
    renderComponent();
    expect(screen.getByTestId('folder-drop-zone')).toBeInTheDocument();
    expect(screen.getByText('Browse')).toBeInTheDocument();
  });

  describe('successful folder upload', () => {
    it('calls chunked upload functions for each file and invokes onCompleted', async () => {
      setupChunkedMocks('file-a');
      const onCompleted = jest.fn();
      renderComponent({ onCompleted });

      const file1 = createTestFile('a.txt', 'text/plain', 1024);
      const file2 = createTestFile('b.txt', 'text/plain', 2048);

      // Assign webkitRelativePath to simulate folder selection
      Object.defineProperty(file1, 'webkitRelativePath', { value: 'myFolder/a.txt' });
      Object.defineProperty(file2, 'webkitRelativePath', { value: 'myFolder/b.txt' });

      // Use different fileIds for each file
      initiateUpload
        .mockResolvedValueOnce({ uploadId: 'upload-1', fileId: 'file-a', key: 'key-a' })
        .mockResolvedValueOnce({ uploadId: 'upload-2', fileId: 'file-b', key: 'key-b' });

      const input = screen.getByTestId('folder-input');
      await userEvent.upload(input, [file1, file2]);

      await waitFor(() => {
        expect(onCompleted).toHaveBeenCalled();
      });

      // initiateUpload called once per file
      expect(initiateUpload).toHaveBeenCalledTimes(2);
      expect(initiateUpload).toHaveBeenCalledWith(
        expect.objectContaining({ filename: 'a.txt', mimeType: 'text/plain', size: 1024 }),
      );
      expect(initiateUpload).toHaveBeenCalledWith(
        expect.objectContaining({ filename: 'b.txt', mimeType: 'text/plain', size: 2048 }),
      );

      // chunkFile called once per file
      expect(chunkFile).toHaveBeenCalledTimes(2);

      // uploadPartToUrl called for each chunk of each file (2 chunks x 2 files = 4)
      expect(uploadPartToUrl).toHaveBeenCalledTimes(4);

      // completeUpload called once per file
      expect(completeUpload).toHaveBeenCalledTimes(2);
      expect(completeUpload).toHaveBeenCalledWith('file-a', [
        { partNumber: 1, etag: 'etag-1' },
        { partNumber: 2, etag: 'etag-2' },
      ]);
      expect(completeUpload).toHaveBeenCalledWith('file-b', [
        { partNumber: 1, etag: 'etag-1' },
        { partNumber: 2, etag: 'etag-2' },
      ]);

      // abortUpload should not be called on success
      expect(abortUpload).not.toHaveBeenCalled();
    });
  });

  describe('error on one file', () => {
    it('calls abortUpload for the failed file and shows error', async () => {
      setupChunkedMocks();
      const onCompleted = jest.fn();
      renderComponent({ onCompleted });

      const file1 = createTestFile('good.txt', 'text/plain', 1024);
      Object.defineProperty(file1, 'webkitRelativePath', { value: 'myFolder/good.txt' });

      const file2 = createTestFile('bad.txt', 'text/plain', 2048);
      Object.defineProperty(file2, 'webkitRelativePath', { value: 'myFolder/bad.txt' });

      // First file succeeds, second file fails during uploadPart
      initiateUpload
        .mockResolvedValueOnce({ uploadId: 'upload-1', fileId: 'file-good', key: 'key-1' })
        .mockResolvedValueOnce({ uploadId: 'upload-2', fileId: 'file-bad', key: 'key-2' });

      let callCount = 0;
      uploadPartToUrl.mockImplementation(({ partNumber }: { partNumber: number }) => {
        callCount++;
        // First 2 calls are for file-good (succeed), 3rd call is first chunk of file-bad (fail)
        if (callCount <= 2) {
          return Promise.resolve({ partNumber, etag: `etag-${partNumber}` });
        }
        return Promise.reject(new Error('Network error'));
      });

      const input = screen.getByTestId('folder-input');
      await userEvent.upload(input, [file1, file2]);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // abortUpload called for the failed file
      expect(abortUpload).toHaveBeenCalledWith('file-bad');
      expect(abortUpload).toHaveBeenCalledTimes(1);

      // onCompleted should NOT have been called since the upload errored
      expect(onCompleted).not.toHaveBeenCalled();
    });
  });
});
