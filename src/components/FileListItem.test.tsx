import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileListItem, { FileListItemProps } from './FileListItem';
import { IFile } from '../types';

const baseFile: IFile = {
  id: '1',
  user_id: 'u1',
  folder_id: null,
  name: 'report.pdf',
  s3_key: 'files/report.pdf',
  size_bytes: 2048,
  mime_type: 'application/pdf',
  is_deleted: false,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-03-15T12:00:00Z',
};

function renderComponent(overrides: Partial<FileListItemProps> = {}) {
  const props: FileListItemProps = {
    file: baseFile,
    isOwner: true,
    ...overrides,
  };
  return render(<FileListItem {...props} />);
}

describe('FileListItem', () => {
  it('renders file name, size, and date', () => {
    renderComponent();
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
    expect(screen.getByText(/Mar 15, 2026/)).toBeInTheDocument();
  });

  it('shows owner actions in the menu', async () => {
    renderComponent();
    await userEvent.click(screen.getByLabelText('actions'));

    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
    expect(screen.getByText('Rename')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('hides owner-only actions for non-owner', async () => {
    renderComponent({ isOwner: false });
    await userEvent.click(screen.getByLabelText('actions'));

    expect(screen.getByText('Download')).toBeInTheDocument();
    expect(screen.queryByText('Rename')).not.toBeInTheDocument();
    expect(screen.queryByText('Share')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('hides Preview for non-previewable files', async () => {
    renderComponent({ file: { ...baseFile, mime_type: 'application/zip' } });
    await userEvent.click(screen.getByLabelText('actions'));

    expect(screen.queryByText('Preview')).not.toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  it('calls onDownload when Download is clicked', async () => {
    const onDownload = jest.fn();
    renderComponent({ onDownload });
    await userEvent.click(screen.getByLabelText('actions'));
    await userEvent.click(screen.getByText('Download'));

    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('calls onPreview when Preview is clicked', async () => {
    const onPreview = jest.fn();
    renderComponent({ onPreview });
    await userEvent.click(screen.getByLabelText('actions'));
    await userEvent.click(screen.getByText('Preview'));

    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  it('calls onRename when Rename is clicked', async () => {
    const onRename = jest.fn();
    renderComponent({ onRename });
    await userEvent.click(screen.getByLabelText('actions'));
    await userEvent.click(screen.getByText('Rename'));

    expect(onRename).toHaveBeenCalledTimes(1);
  });

  it('calls onShare when Share is clicked', async () => {
    const onShare = jest.fn();
    renderComponent({ onShare });
    await userEvent.click(screen.getByLabelText('actions'));
    await userEvent.click(screen.getByText('Share'));

    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when Delete is clicked', async () => {
    const onDelete = jest.fn();
    renderComponent({ onDelete });
    await userEvent.click(screen.getByLabelText('actions'));
    await userEvent.click(screen.getByText('Delete'));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('closes the menu after an action is clicked', async () => {
    const onDownload = jest.fn();
    renderComponent({ onDownload });
    await userEvent.click(screen.getByLabelText('actions'));
    await userEvent.click(screen.getByText('Download'));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
