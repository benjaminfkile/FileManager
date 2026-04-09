import React from 'react';
import { render, screen } from '@testing-library/react';
import LoadingSkeleton from './LoadingSkeleton';

describe('LoadingSkeleton', () => {
  it('renders 5 skeleton rows by default', () => {
    const { container } = render(<LoadingSkeleton />);
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(5);
  });

  it('renders the specified number of rows', () => {
    const { container } = render(<LoadingSkeleton count={3} />);
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(3);
  });

  it('renders rectangular and text skeletons in each row', () => {
    const { container } = render(<LoadingSkeleton count={1} />);
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    const rectangular = container.querySelectorAll(
      '.MuiSkeleton-rectangular'
    );
    const text = container.querySelectorAll('.MuiSkeleton-text');
    expect(rectangular).toHaveLength(1);
    expect(text).toHaveLength(2);
    expect(skeletons).toHaveLength(3);
  });

  it('renders zero rows when count is 0', () => {
    const { container } = render(<LoadingSkeleton count={0} />);
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(0);
  });
});
