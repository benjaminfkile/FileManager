import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ShareLinkPage from './ShareLinkPage';
import * as shareLinkService from '../api/shareLinkService';
import * as useFolderDownloadModule from '../hooks/useFolderDownload';
import { IFile, IFolder } from '../types';

jest.mock('../api/shareLinkService');
jest.mock('../hooks/useFolderDownload', () => ({
  useFolderDownload: jest.fn(),
}));
jest.mock('../utils/downloadHelpers', () => ({
  triggerDownloadFromUrl: jest.fn().mockResolvedValue(undefined),
  triggerDownloadFromBlob: jest.fn(),
}));
// FilePreviewDialog is complex — stub it out
jest.mock('../components/FilePreviewDialog', () => ({
  __esModule: true,
  default: function MockFilePreviewDialog({ open }: { open: boolean }) {
    return open ? require('react').createElement('div', { 'data-testid': 'preview-dialog' }) : null;
  },
}));

const mockStartFolderDownload = jest.fn();

const mockedResolveShareLink = shareLinkService.resolveShareLink as jest.MockedFunction<
  typeof shareLinkService.resolveShareLink
>;
const mockedBrowseFolderViaLink = shareLinkService.browseFolderViaLink as jest.MockedFunction<
  typeof shareLinkService.browseFolderViaLink
>;
const mockedDownloadFileViaLink = shareLinkService.downloadFileViaLink as jest.MockedFunction<
  typeof shareLinkService.downloadFileViaLink
>;

const mockFolder: IFolder = {
  id: 'root-folder',
  user_id: 'u1',
  parent_folder_id: null,
  name: 'Shared Folder',
  is_deleted: false,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockSubFolder: IFolder = {
  id: 'sub1',
  user_id: 'u1',
  parent_folder_id: 'root-folder',
  name: 'Sub Folder',
  is_deleted: false,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockFile: IFile = {
  id: 'file1',
  user_id: 'u1',
  folder_id: 'root-folder',
  name: 'document.pdf',
  s3_key: 'key/document.pdf',
  size_bytes: 1024,
  mime_type: 'application/pdf',
  is_deleted: false,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockFileForFileShare: IFile = {
  id: 'file-share',
  user_id: 'u1',
  folder_id: null,
  name: 'image.png',
  s3_key: 'key/image.png',
  size_bytes: 2048,
  mime_type: 'image/png',
  is_deleted: false,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function renderPage(token = 'test-token') {
  return render(
    <MemoryRouter initialEntries={[`/share/${token}`]}>
      <Routes>
        <Route path="/share/:token" element={<ShareLinkPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  (useFolderDownloadModule.useFolderDownload as jest.Mock).mockReturnValue({
    start: mockStartFolderDownload,
    jobs: [],
  });
});

describe('ShareLinkPage', () => {
  describe('loading and error states', () => {
    it('shows loading skeleton while resolving link', () => {
      mockedResolveShareLink.mockReturnValue(new Promise(() => {}));
      renderPage();
      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error state for invalid/expired links', async () => {
      mockedResolveShareLink.mockRejectedValue(new Error('Not found'));
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('This link is invalid or has expired.')).toBeInTheDocument();
      });
    });
  });

  describe('file share', () => {
    beforeEach(() => {
      mockedResolveShareLink.mockResolvedValue({
        linkInfo: { expires_at: null },
        itemType: 'file',
        file: mockFileForFileShare,
      } as shareLinkService.ResolvedFileLinkResponse);
      mockedDownloadFileViaLink.mockResolvedValue({
        url: 'https://cdn.example.com/image.png',
        expiresAt: '2026-12-31T00:00:00Z',
      });
    });

    it('renders file name for a file share', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('image.png')).toBeInTheDocument();
      });
    });
  });

  describe('folder share', () => {
    beforeEach(() => {
      mockedResolveShareLink.mockResolvedValue({
        linkInfo: { expires_at: null },
        itemType: 'folder',
        folder: mockFolder,
        subFolders: [mockSubFolder],
        files: [mockFile],
      } as shareLinkService.ResolvedFolderLinkResponse);
    });

    it('renders folder contents', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Sub Folder')).toBeInTheDocument();
      });
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
    });

    it('renders breadcrumb with folder name', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Shared Folder')).toBeInTheDocument();
      });
    });

    it('calls startFolderDownload with share-link functions when download button is clicked', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Shared Folder')).toBeInTheDocument();
      });

      const downloadWrapper = screen.getByLabelText('Download folder as ZIP');
      const downloadButton = downloadWrapper.querySelector('button');
      expect(downloadButton).not.toBeNull();
      await userEvent.click(downloadButton!);

      expect(mockStartFolderDownload).toHaveBeenCalledWith(
        'root-folder',
        'Shared Folder',
        expect.objectContaining({
          prepareFn: expect.any(Function),
          statusFn: expect.any(Function),
        })
      );
    });

    it('shows empty state when folder has no contents', async () => {
      mockedResolveShareLink.mockResolvedValue({
        linkInfo: { expires_at: null },
        itemType: 'folder',
        folder: mockFolder,
        subFolders: [],
        files: [],
      } as shareLinkService.ResolvedFolderLinkResponse);

      renderPage();
      await waitFor(() => {
        expect(screen.getByText('This folder is empty')).toBeInTheDocument();
      });
    });

    it('navigates into a sub-folder on click', async () => {
      mockedBrowseFolderViaLink.mockResolvedValue({
        folder: mockSubFolder,
        subFolders: [],
        files: [],
      });

      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Sub Folder')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Sub Folder'));

      await waitFor(() => {
        expect(mockedBrowseFolderViaLink).toHaveBeenCalledWith('test-token', 'sub1');
      });
    });

    it('disables download button when a folder download is in flight', async () => {
      (useFolderDownloadModule.useFolderDownload as jest.Mock).mockReturnValue({
        start: mockStartFolderDownload,
        jobs: [
          {
            id: 'j1',
            folderId: 'root-folder',
            folderName: 'Shared Folder',
            status: 'processing',
            createdAt: Date.now(),
            prepareFn: jest.fn(),
            statusFn: jest.fn(),
          },
        ],
      });

      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Shared Folder')).toBeInTheDocument();
      });

      const downloadButton = screen.getByLabelText('Download folder as ZIP');
      expect(downloadButton.querySelector('button')).toBeDisabled();
    });
  });
});
