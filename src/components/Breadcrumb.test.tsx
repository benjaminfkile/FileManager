import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import Breadcrumb, { BreadcrumbProps } from './Breadcrumb';

const theme = createTheme();

function renderBreadcrumb(props: BreadcrumbProps) {
  return render(
    <ThemeProvider theme={theme}>
      <Breadcrumb {...props} />
    </ThemeProvider>,
  );
}

describe('Breadcrumb', () => {
  const onNavigate = jest.fn();

  beforeEach(() => {
    onNavigate.mockClear();
  });

  it('renders all crumbs in order', () => {
    const crumbs = [
      { id: null, name: 'My Files' },
      { id: '1', name: 'Documents' },
      { id: '2', name: 'Work' },
    ];
    renderBreadcrumb({ crumbs, onNavigate });

    expect(screen.getByText('My Files')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
  });

  it('renders the current folder (last crumb) as plain text, not a link', () => {
    const crumbs = [
      { id: null, name: 'My Files' },
      { id: '1', name: 'Documents' },
    ];
    renderBreadcrumb({ crumbs, onNavigate });

    const current = screen.getByText('Documents');
    expect(current.tagName).toBe('P');
    expect(current.closest('button')).toBeNull();
  });

  it('renders ancestor crumbs as clickable links', () => {
    const crumbs = [
      { id: null, name: 'My Files' },
      { id: '1', name: 'Documents' },
      { id: '2', name: 'Work' },
    ];
    renderBreadcrumb({ crumbs, onNavigate });

    const myFiles = screen.getByText('My Files');
    expect(myFiles.tagName).toBe('BUTTON');

    const documents = screen.getByText('Documents');
    expect(documents.tagName).toBe('BUTTON');
  });

  it('clicking an intermediate crumb calls onNavigate with its id', () => {
    const crumbs = [
      { id: null, name: 'My Files' },
      { id: '1', name: 'Documents' },
      { id: '2', name: 'Work' },
    ];
    renderBreadcrumb({ crumbs, onNavigate });

    fireEvent.click(screen.getByText('Documents'));
    expect(onNavigate).toHaveBeenCalledWith('1');
  });

  it('clicking the root crumb calls onNavigate with null', () => {
    const crumbs = [
      { id: null, name: 'My Files' },
      { id: '1', name: 'Documents' },
    ];
    renderBreadcrumb({ crumbs, onNavigate });

    fireEvent.click(screen.getByText('My Files'));
    expect(onNavigate).toHaveBeenCalledWith(null);
  });

  it('renders only root as plain text when there is a single crumb', () => {
    const crumbs = [{ id: null, name: 'My Files' }];
    renderBreadcrumb({ crumbs, onNavigate });

    const myFiles = screen.getByText('My Files');
    expect(myFiles.tagName).toBe('P');
  });
});
