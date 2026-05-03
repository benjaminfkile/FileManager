import { render, screen, act } from '@testing-library/react';
import SessionExpiryBanner from './SessionExpiryBanner';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-05-03T12:00:00.000Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('SessionExpiryBanner', () => {
  it('renders an info banner with mm:ss remaining when there is plenty of time left', () => {
    const expiresAt = new Date('2026-05-03T12:30:00.000Z').toISOString(); // +30 min

    render(<SessionExpiryBanner expiresAt={expiresAt} />);

    expect(screen.getByText(/your data will be wiped in 30:00/i)).toBeInTheDocument();
    // Info severity for >5 min remaining
    expect(screen.getByRole('alert').className).toMatch(/MuiAlert-colorInfo/);
  });

  it('shows the error severity when under 5 minutes remain', () => {
    const expiresAt = new Date('2026-05-03T12:04:00.000Z').toISOString(); // +4 min

    render(<SessionExpiryBanner expiresAt={expiresAt} />);

    expect(screen.getByText(/4:00/)).toBeInTheDocument();
    expect(screen.getByRole('alert').className).toMatch(/MuiAlert-colorError/);
  });

  it('updates the countdown every second', () => {
    const expiresAt = new Date('2026-05-03T12:10:00.000Z').toISOString(); // +10 min

    render(<SessionExpiryBanner expiresAt={expiresAt} />);
    expect(screen.getByText(/10:00/)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(screen.getByText(/9:58/)).toBeInTheDocument();
  });

  it('shows the expired message once the deadline has passed', () => {
    const expiresAt = new Date('2026-05-03T11:59:00.000Z').toISOString(); // already past

    render(<SessionExpiryBanner expiresAt={expiresAt} />);

    expect(
      screen.getByText(/demo session expired — refresh the page/i),
    ).toBeInTheDocument();
  });
});
