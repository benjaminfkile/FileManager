import MockAdapter from 'axios-mock-adapter';
import apiClient from './apiClient';
import { setupInterceptors, ejectInterceptor } from './setupInterceptors';

const mock = new MockAdapter(apiClient);

let logout: jest.Mock;
let navigate: jest.Mock;
let interceptorId: number;

beforeEach(() => {
  logout = jest.fn();
  navigate = jest.fn();
  interceptorId = setupInterceptors(logout, navigate);
});

afterEach(() => {
  ejectInterceptor(interceptorId);
  mock.reset();
});

describe('setupInterceptors', () => {
  it('calls logout and navigates to /login on 401', async () => {
    mock.onGet('/test').reply(401);

    await expect(apiClient.get('/test')).rejects.toThrow();

    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('does not call logout or navigate on 500', async () => {
    mock.onGet('/test').reply(500);

    await expect(apiClient.get('/test')).rejects.toThrow();

    expect(logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not call logout or navigate on 403', async () => {
    mock.onGet('/test').reply(403);

    await expect(apiClient.get('/test')).rejects.toThrow();

    expect(logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('passes through successful responses', async () => {
    mock.onGet('/test').reply(200, { ok: true });

    const response = await apiClient.get('/test');

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ ok: true });
    expect(logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('re-throws the error so callers can still catch it', async () => {
    mock.onGet('/test').reply(401);

    try {
      await apiClient.get('/test');
      fail('should have thrown');
    } catch (error: any) {
      expect(error.response.status).toBe(401);
    }
  });

  it('does not trigger after interceptor is ejected', async () => {
    ejectInterceptor(interceptorId);
    mock.onGet('/test').reply(401);

    await expect(apiClient.get('/test')).rejects.toThrow();

    expect(logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
