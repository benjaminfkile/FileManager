import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RenameDialog, { RenameDialogProps } from './RenameDialog';

function renderDialog(overrides: Partial<RenameDialogProps> = {}) {
  const props: RenameDialogProps = {
    open: true,
    currentName: 'my-file.txt',
    itemType: 'file',
    onClose: jest.fn(),
    onRename: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return { ...render(<RenameDialog {...props} />), props };
}

describe('RenameDialog', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders with current name pre-filled', () => {
    renderDialog();
    expect(screen.getByText('Rename File')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('my-file.txt');
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders with Rename Folder title for folder itemType', () => {
    renderDialog({ itemType: 'folder' });
    expect(screen.getByText('Rename Folder')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    renderDialog({ open: false });
    expect(screen.queryByText('Rename File')).not.toBeInTheDocument();
  });

  it('shows validation error for empty name', async () => {
    renderDialog();
    const input = screen.getByLabelText('Name');
    await userEvent.clear(input);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('shows validation error for name with /', async () => {
    renderDialog();
    const input = screen.getByLabelText('Name');
    await userEvent.clear(input);
    await userEvent.type(input, 'a/b');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText(/cannot contain/)).toBeInTheDocument();
  });

  it('shows validation error for name with backslash', async () => {
    renderDialog();
    const input = screen.getByLabelText('Name');
    await userEvent.clear(input);
    await userEvent.type(input, 'a\\b');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText(/cannot contain/)).toBeInTheDocument();
  });

  it('shows validation error for . name', async () => {
    renderDialog();
    const input = screen.getByLabelText('Name');
    await userEvent.clear(input);
    await userEvent.type(input, '.');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText(/cannot contain/)).toBeInTheDocument();
  });

  it('shows validation error for .. name', async () => {
    renderDialog();
    const input = screen.getByLabelText('Name');
    await userEvent.clear(input);
    await userEvent.type(input, '..');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText(/cannot contain/)).toBeInTheDocument();
  });

  it('calls onRename and onClose on successful rename', async () => {
    const { props } = renderDialog();
    const input = screen.getByLabelText('Name');
    await userEvent.clear(input);
    await userEvent.type(input, 'new-name.txt');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(props.onRename).toHaveBeenCalledWith('new-name.txt');
    });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('displays API error inside the dialog', async () => {
    const onRename = jest.fn().mockRejectedValue(new Error('Name already exists'));
    renderDialog({ onRename });
    const input = screen.getByLabelText('Name');
    await userEvent.clear(input);
    await userEvent.type(input, 'duplicate');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Name already exists')).toBeInTheDocument();
    });
    // Dialog should remain open (onClose not called)
    expect(screen.getByText('Rename File')).toBeInTheDocument();
  });

  it('submits on Enter key press', async () => {
    const { props } = renderDialog();
    const input = screen.getByLabelText('Name');
    await userEvent.clear(input);
    await userEvent.type(input, 'new-name.txt{enter}');

    await waitFor(() => {
      expect(props.onRename).toHaveBeenCalledWith('new-name.txt');
    });
  });

  it('calls onClose when Cancel is clicked', async () => {
    const { props } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('clears validation error when user types', async () => {
    renderDialog();
    const input = screen.getByLabelText('Name');
    await userEvent.clear(input);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Name is required')).toBeInTheDocument();

    await userEvent.type(input, 'a');
    expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
  });

  it('trims the name before calling onRename', async () => {
    const { props } = renderDialog();
    const input = screen.getByLabelText('Name');
    await userEvent.clear(input);
    await userEvent.type(input, '  spaced  ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(props.onRename).toHaveBeenCalledWith('spaced');
    });
  });
});
