import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FolderListItem, { FolderListItemProps } from './FolderListItem';
import { IFolder } from '../types';

const baseFolder: IFolder = {
  id: 'f1',
  user_id: 'u1',
  parent_folder_id: null,
  name: 'Documents',
  is_deleted: false,
  deleted_at: null,
  created_at: '2026-02-10T00:00:00Z',
  updated_at: '2026-03-20T12:00:00Z',
};

function renderComponent(overrides: Partial<FolderListItemProps> = {}) {
  const props: FolderListItemProps = {
    folder: baseFolder,
    isOwner: true,
    onClick: jest.fn(),
    ...overrides,
  };
  return render(<FolderListItem {...props} />);
}

describe('FolderListItem', () => {
  it('renders folder name and creation date', () => {
    renderComponent();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText(/Feb \d{1,2}, 2026/)).toBeInTheDocument();
  });

  it('calls onClick when the row is clicked', async () => {
    const onClick = jest.fn();
    renderComponent({ onClick });
    await userEvent.click(screen.getByText('Documents'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows all actions for owner in the menu', async () => {
    renderComponent();
    await userEvent.click(screen.getByLabelText('actions'));

    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Download as zip')).toBeInTheDocument();
    expect(screen.getByText('Rename')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('hides owner-only actions for non-owner', async () => {
    renderComponent({ isOwner: false });
    await userEvent.click(screen.getByLabelText('actions'));

    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Download as zip')).toBeInTheDocument();
    expect(screen.queryByText('Rename')).not.toBeInTheDocument();
    expect(screen.queryByText('Share')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('calls onDownload when Download as zip is clicked', async () => {
    const onDownload = jest.fn();
    renderComponent({ onDownload });
    await userEvent.click(screen.getByLabelText('actions'));
    await userEvent.click(screen.getByText('Download as zip'));

    expect(onDownload).toHaveBeenCalledTimes(1);
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

  it('calls onClick when Open menu item is clicked', async () => {
    const onClick = jest.fn();
    renderComponent({ onClick });
    await userEvent.click(screen.getByLabelText('actions'));
    await userEvent.click(screen.getByText('Open'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('closes the menu after an action is clicked', async () => {
    const onDownload = jest.fn();
    renderComponent({ onDownload });
    await userEvent.click(screen.getByLabelText('actions'));
    await userEvent.click(screen.getByText('Download as zip'));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
