import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

test('renders file manager', () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
  const element = screen.getByText(/file manager/i);
  expect(element).toBeInTheDocument();
});
