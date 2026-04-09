import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider, useThemeMode } from './ThemeProvider';

function TestConsumer() {
  const { mode, toggleMode } = useThemeMode();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={toggleMode}>toggle</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
});

test('renders children', () => {
  render(
    <ThemeProvider>
      <p>hello</p>
    </ThemeProvider>
  );
  expect(screen.getByText('hello')).toBeInTheDocument();
});

test('defaults to light mode', () => {
  render(
    <ThemeProvider>
      <TestConsumer />
    </ThemeProvider>
  );
  expect(screen.getByTestId('mode')).toHaveTextContent('light');
});

test('toggleMode switches mode and persists to localStorage', () => {
  render(
    <ThemeProvider>
      <TestConsumer />
    </ThemeProvider>
  );

  act(() => {
    screen.getByText('toggle').click();
  });

  expect(screen.getByTestId('mode')).toHaveTextContent('dark');
  expect(localStorage.getItem('fm_theme')).toBe('dark');

  act(() => {
    screen.getByText('toggle').click();
  });

  expect(screen.getByTestId('mode')).toHaveTextContent('light');
  expect(localStorage.getItem('fm_theme')).toBe('light');
});

test('reads initial mode from localStorage', () => {
  localStorage.setItem('fm_theme', 'dark');
  render(
    <ThemeProvider>
      <TestConsumer />
    </ThemeProvider>
  );
  expect(screen.getByTestId('mode')).toHaveTextContent('dark');
});
