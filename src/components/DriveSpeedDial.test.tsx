import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DriveSpeedDial from './DriveSpeedDial';

jest.mock('../api/folderService');
jest.mock('../api/fileService');

const defaultProps = {
  folderId: 'folder-1',
  onFolderCreated: jest.fn(),
  onFileUploaded: jest.fn(),
};

function renderComponent(props = {}) {
  return render(<DriveSpeedDial {...defaultProps} {...props} />);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DriveSpeedDial', () => {
  it('renders the SpeedDial button', () => {
    renderComponent();
    expect(screen.getByRole('button', { name: 'file actions' })).toBeInTheDocument();
  });

  it('shows both actions when opened', async () => {
    renderComponent();

    await userEvent.click(screen.getByRole('button', { name: 'file actions' }));

    expect(screen.getByRole('menuitem', { name: 'Upload file' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New folder' })).toBeInTheDocument();
  });

  it('opens upload dialog when Upload file action is clicked', async () => {
    renderComponent();

    await userEvent.click(screen.getByRole('button', { name: 'file actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Upload file' }));

    await waitFor(() => {
      expect(screen.getByText('Upload File')).toBeInTheDocument();
    });
  });

  it('opens create folder dialog when New folder action is clicked', async () => {
    renderComponent();

    await userEvent.click(screen.getByRole('button', { name: 'file actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'New folder' }));

    await waitFor(() => {
      expect(screen.getByText('New Folder')).toBeInTheDocument();
    });
  });

  it('closes upload dialog when close button is clicked', async () => {
    renderComponent();

    await userEvent.click(screen.getByRole('button', { name: 'file actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Upload file' }));

    await waitFor(() => {
      expect(screen.getByText('Upload File')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText('close'));

    await waitFor(() => {
      expect(screen.queryByText('Upload File')).not.toBeInTheDocument();
    });
  });
});
