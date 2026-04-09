import React from 'react';
import { render, screen } from '@testing-library/react';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState title="No files here" />);
    expect(screen.getByText('No files here')).toBeInTheDocument();
  });

  it('renders the default FolderOpen icon when no icon prop is provided', () => {
    const { container } = render(<EmptyState title="Empty" />);
    const icon = container.querySelector('[data-testid="FolderOpenIcon"]');
    expect(icon).toBeInTheDocument();
  });

  it('renders a custom icon when provided', () => {
    render(<EmptyState title="Empty" icon={<span data-testid="custom-icon" />} />);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('renders the description when provided', () => {
    render(<EmptyState title="Empty" description="Upload something" />);
    expect(screen.getByText('Upload something')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    const { container } = render(<EmptyState title="Empty" />);
    const paragraphs = container.querySelectorAll('.MuiTypography-body2');
    expect(paragraphs).toHaveLength(0);
  });

  it('renders the action slot when provided', () => {
    render(
      <EmptyState
        title="Empty"
        action={<button data-testid="cta">Upload</button>}
      />
    );
    expect(screen.getByTestId('cta')).toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
  });

  it('does not render the action slot when not provided', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByTestId('cta')).not.toBeInTheDocument();
  });
});
