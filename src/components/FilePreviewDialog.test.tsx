import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilePreviewDialog, { FilePreviewDialogProps } from './FilePreviewDialog';
import { previewFile } from '../api/fileService';

jest.mock('../api/fileService');
const mockPreviewFile = previewFile as jest.MockedFunction<typeof previewFile>;

function renderDialog(overrides: Partial<FilePreviewDialogProps> = {}) {
  const props: FilePreviewDialogProps = {
    open: true,
    fileId: 'file-1',
    fileName: 'photo.png',
    onClose: jest.fn(),
    onDownload: jest.fn(),
    ...overrides,
  };
  const result = render(<FilePreviewDialog {...props} />);
  return { ...result, props };
}

beforeEach(() => {
  jest.resetAllMocks();
});

it('shows loading state while fetching preview', () => {
  mockPreviewFile.mockReturnValue(new Promise(() => {}));
  renderDialog();
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('renders image for image/* mime type', async () => {
  mockPreviewFile.mockResolvedValue({
    url: 'https://example.com/photo.png',
    mimeType: 'image/png',
    expiresAt: '2026-01-01T00:00:00Z',
  });
  renderDialog();

  const img = await screen.findByRole('img', { name: 'photo.png' });
  expect(img).toHaveAttribute('src', 'https://example.com/photo.png');
});

it('renders video for video/* mime type', async () => {
  mockPreviewFile.mockResolvedValue({
    url: 'https://example.com/clip.mp4',
    mimeType: 'video/mp4',
    expiresAt: '2026-01-01T00:00:00Z',
  });
  renderDialog({ fileName: 'clip.mp4' });

  await waitFor(() => {
    const video = document.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('src', 'https://example.com/clip.mp4');
  });
});

it('renders iframe for application/pdf', async () => {
  mockPreviewFile.mockResolvedValue({
    url: 'https://example.com/doc.pdf',
    mimeType: 'application/pdf',
    expiresAt: '2026-01-01T00:00:00Z',
  });
  renderDialog({ fileName: 'doc.pdf' });

  await waitFor(() => {
    const iframe = document.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'https://example.com/doc.pdf');
  });
});

it('shows "Preview not available" for unsupported mime types', async () => {
  mockPreviewFile.mockResolvedValue({
    url: 'https://example.com/data.zip',
    mimeType: 'application/zip',
    expiresAt: '2026-01-01T00:00:00Z',
  });
  renderDialog({ fileName: 'data.zip' });

  expect(await screen.findByText('Preview not available')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
});

it('unsupported type Download button calls onDownload', async () => {
  mockPreviewFile.mockResolvedValue({
    url: 'https://example.com/data.zip',
    mimeType: 'application/zip',
    expiresAt: '2026-01-01T00:00:00Z',
  });
  const { props } = renderDialog({ fileName: 'data.zip' });

  const btn = await screen.findByRole('button', { name: 'Download' });
  await userEvent.click(btn);
  expect(props.onDownload).toHaveBeenCalled();
});

it('toolbar download button calls onDownload', async () => {
  mockPreviewFile.mockResolvedValue({
    url: 'https://example.com/photo.png',
    mimeType: 'image/png',
    expiresAt: '2026-01-01T00:00:00Z',
  });
  const { props } = renderDialog();

  await screen.findByRole('img', { name: 'photo.png' });
  await userEvent.click(screen.getByRole('button', { name: 'download' }));
  expect(props.onDownload).toHaveBeenCalled();
});

it('close button calls onClose', async () => {
  mockPreviewFile.mockResolvedValue({
    url: 'https://example.com/photo.png',
    mimeType: 'image/png',
    expiresAt: '2026-01-01T00:00:00Z',
  });
  const { props } = renderDialog();

  await screen.findByRole('img', { name: 'photo.png' });
  await userEvent.click(screen.getByRole('button', { name: 'close' }));
  expect(props.onClose).toHaveBeenCalled();
});

it('displays file name in dialog title', () => {
  mockPreviewFile.mockReturnValue(new Promise(() => {}));
  renderDialog({ fileName: 'my-document.pdf' });
  expect(screen.getByText('my-document.pdf')).toBeInTheDocument();
});

it('calls previewFile with the correct fileId', () => {
  mockPreviewFile.mockReturnValue(new Promise(() => {}));
  renderDialog({ fileId: 'abc-123' });
  expect(mockPreviewFile).toHaveBeenCalledWith('abc-123');
});

it('does not fetch when dialog is closed', () => {
  mockPreviewFile.mockReturnValue(new Promise(() => {}));
  renderDialog({ open: false });
  expect(mockPreviewFile).not.toHaveBeenCalled();
});
