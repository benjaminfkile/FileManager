import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { NotificationProvider, useNotification } from './NotificationContext';

function TestConsumer() {
  const { showNotification } = useNotification();
  return (
    <div>
      <button onClick={() => showNotification('File uploaded')}>notify</button>
      <button onClick={() => showNotification('Something failed', 'error')}>error</button>
    </div>
  );
}

test('renders children without exploding', () => {
  render(
    <NotificationProvider>
      <p>hello</p>
    </NotificationProvider>,
  );
  expect(screen.getByText('hello')).toBeInTheDocument();
});

test('calling showNotification renders a Snackbar with the correct message', () => {
  render(
    <NotificationProvider>
      <TestConsumer />
    </NotificationProvider>,
  );

  act(() => {
    screen.getByText('notify').click();
  });

  expect(screen.getByText('File uploaded')).toBeInTheDocument();
});

test("severity 'error' shows an error Alert", () => {
  render(
    <NotificationProvider>
      <TestConsumer />
    </NotificationProvider>,
  );

  act(() => {
    screen.getByText('error').click();
  });

  expect(screen.getByText('Something failed')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveClass('MuiAlert-colorError');
});
