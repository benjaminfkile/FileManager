import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeleteConfirmationDialog, {
  DeleteConfirmationDialogProps,
} from './DeleteConfirmationDialog';

function renderDialog(overrides: Partial<DeleteConfirmationDialogProps> = {}) {
  const props: DeleteConfirmationDialogProps = {
    open: true,
    title: 'Delete file?',
    description: 'This file will be moved to the Recycle Bin.',
    onClose: jest.fn(),
    onConfirm: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const result = render(<DeleteConfirmationDialog {...props} />);
  return { ...result, props };
}

beforeEach(() => {
  jest.resetAllMocks();
});

it('renders title and description', () => {
  renderDialog();
  expect(screen.getByText('Delete file?')).toBeInTheDocument();
  expect(
    screen.getByText('This file will be moved to the Recycle Bin.')
  ).toBeInTheDocument();
});

it('renders default confirm label', () => {
  renderDialog();
  expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
});

it('renders custom confirm label', () => {
  renderDialog({ confirmLabel: 'Empty Bin' });
  expect(
    screen.getByRole('button', { name: 'Empty Bin' })
  ).toBeInTheDocument();
});

it('cancel closes without calling onConfirm', async () => {
  const { props } = renderDialog();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(props.onClose).toHaveBeenCalled();
  expect(props.onConfirm).not.toHaveBeenCalled();
});

it('confirm calls onConfirm and closes on success', async () => {
  const { props } = renderDialog();
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(() => {
    expect(props.onConfirm).toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });
});

it('shows loading state while onConfirm is pending', async () => {
  let resolve: () => void;
  const pending = new Promise<void>((r) => {
    resolve = r;
  });
  const { props } = renderDialog({
    onConfirm: jest.fn().mockReturnValue(pending),
  });

  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

  expect(screen.getByRole('progressbar')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

  resolve!();
  await waitFor(() => {
    expect(props.onClose).toHaveBeenCalled();
  });
});

it('isDangerous makes confirm button use error color', () => {
  renderDialog({ isDangerous: true });
  const btn = screen.getByRole('button', { name: 'Delete' });
  expect(btn).toHaveClass('MuiButton-colorError');
});

it('non-dangerous confirm button uses primary color', () => {
  renderDialog({ isDangerous: false });
  const btn = screen.getByRole('button', { name: 'Delete' });
  expect(btn).toHaveClass('MuiButton-colorPrimary');
});

it('does not close when onConfirm rejects', async () => {
  const { props } = renderDialog({
    onConfirm: jest.fn().mockRejectedValue(new Error('fail')),
  });
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(() => {
    expect(props.onConfirm).toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
