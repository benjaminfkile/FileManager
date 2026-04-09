import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateFolderDialog, { CreateFolderDialogProps } from './CreateFolderDialog';
import { createFolder } from '../api/folderService';
import { IFolder } from '../types';

jest.mock('../api/folderService');
const mockCreateFolder = createFolder as jest.MockedFunction<typeof createFolder>;

const createdFolder: IFolder = {
  id: 'f1',
  user_id: 'u1',
  parent_folder_id: null,
  name: 'New Folder',
  is_deleted: false,
  deleted_at: null,
  created_at: '2026-04-08T00:00:00Z',
  updated_at: '2026-04-08T00:00:00Z',
};

function renderDialog(overrides: Partial<CreateFolderDialogProps> = {}) {
  const props: CreateFolderDialogProps = {
    open: true,
    parentFolderId: null,
    onClose: jest.fn(),
    onCreated: jest.fn(),
    ...overrides,
  };
  return { ...render(<CreateFolderDialog {...props} />), props };
}

describe('CreateFolderDialog', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders the dialog with title and input', () => {
    renderDialog();
    expect(screen.getByText('New Folder')).toBeInTheDocument();
    expect(screen.getByLabelText('Folder name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    renderDialog({ open: false });
    expect(screen.queryByText('New Folder')).not.toBeInTheDocument();
  });

  it('shows validation error for empty name', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByText('Folder name is required')).toBeInTheDocument();
    expect(mockCreateFolder).not.toHaveBeenCalled();
  });

  it('shows validation error for name with /', async () => {
    renderDialog();
    await userEvent.type(screen.getByLabelText('Folder name'), 'a/b');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByText(/cannot contain/)).toBeInTheDocument();
    expect(mockCreateFolder).not.toHaveBeenCalled();
  });

  it('shows validation error for name with backslash', async () => {
    renderDialog();
    await userEvent.type(screen.getByLabelText('Folder name'), 'a\\b');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByText(/cannot contain/)).toBeInTheDocument();
    expect(mockCreateFolder).not.toHaveBeenCalled();
  });

  it('shows validation error for . name', async () => {
    renderDialog();
    await userEvent.type(screen.getByLabelText('Folder name'), '.');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByText(/cannot contain/)).toBeInTheDocument();
  });

  it('shows validation error for .. name', async () => {
    renderDialog();
    await userEvent.type(screen.getByLabelText('Folder name'), '..');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByText(/cannot contain/)).toBeInTheDocument();
  });

  it('calls onCreated and onClose on successful create', async () => {
    mockCreateFolder.mockResolvedValue(createdFolder);
    const { props } = renderDialog();

    await userEvent.type(screen.getByLabelText('Folder name'), 'New Folder');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(props.onCreated).toHaveBeenCalledWith(createdFolder);
    });
    expect(props.onClose).toHaveBeenCalled();
    expect(mockCreateFolder).toHaveBeenCalledWith({ name: 'New Folder' });
  });

  it('passes parentFolderId when provided', async () => {
    mockCreateFolder.mockResolvedValue({ ...createdFolder, parent_folder_id: 'p1' });
    const { props } = renderDialog({ parentFolderId: 'p1' });

    await userEvent.type(screen.getByLabelText('Folder name'), 'Sub Folder');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(mockCreateFolder).toHaveBeenCalledWith({
        name: 'Sub Folder',
        parentFolderId: 'p1',
      });
    });
  });

  it('displays API error inside the dialog', async () => {
    mockCreateFolder.mockRejectedValue(new Error('Name already exists'));
    renderDialog();

    await userEvent.type(screen.getByLabelText('Folder name'), 'Duplicate');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(screen.getByText('Name already exists')).toBeInTheDocument();
    });
  });

  it('submits on Enter key press', async () => {
    mockCreateFolder.mockResolvedValue(createdFolder);
    const { props } = renderDialog();

    await userEvent.type(screen.getByLabelText('Folder name'), 'New Folder{enter}');

    await waitFor(() => {
      expect(props.onCreated).toHaveBeenCalledWith(createdFolder);
    });
  });

  it('calls onClose when Cancel is clicked', async () => {
    const { props } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('clears validation error when user types', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByText('Folder name is required')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Folder name'), 'a');
    expect(screen.queryByText('Folder name is required')).not.toBeInTheDocument();
  });
});
