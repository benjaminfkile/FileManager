import MockAdapter from 'axios-mock-adapter';
import apiClient from './apiClient';
import { setupInterceptors, ejectInterceptor } from './setupInterceptors';
import * as cognitoClient from '../lib/cognitoClient';

jest.mock('../lib/cognitoClient');

const mock = new MockAdapter(apiClient);

let logout: jest.Mock;
let navigate: jest.Mock;
let interceptorId: number;

beforeEach(() => {
  logout = jest.fn();
  navigate = jest.fn();
  // Default: token refresh returns null (no valid session)
  (cognitoClient.getIdToken as jest.Mock).mockResolvedValue(null);
  interceptorId = setupInterceptors(logout, navigate);
});

afterEach(() => {
  ejectInterceptor(interceptorId);
  mock.reset();
});

describe('setupInterceptors', () => {
  it('calls logout and navigates to /login on 401 when token refresh fails', async () => {
    mock.onGet('/test').reply(401);
    (cognitoClient.getIdToken as jest.Mock).mockResolvedValue(null);

    await expect(apiClient.get('/test')).rejects.toThrow();

    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('retries the request with a fresh token on 401 and succeeds without logging out', async () => {
    // First call returns 401, second (retry) returns 200
    mock.onGet('/test').replyOnce(401).onGet('/test').replyOnce(200, { ok: true });
    (cognitoClient.getIdToken as jest.Mock).mockResolvedValue('fresh-token');

    const response = await apiClient.get('/test');

    expect(response.status).toBe(200);
    expect(logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('logs out when the retry also returns 401', async () => {
    mock.onGet('/test').reply(401);
    (cognitoClient.getIdToken as jest.Mock).mockResolvedValue('fresh-token');

    await expect(apiClient.get('/test')).rejects.toThrow();

    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('does not retry a second time if _retry is already set', async () => {
    // Simulates a 401 on the retry request — should not loop
    mock.onGet('/test').reply(401);
    (cognitoClient.getIdToken as jest.Mock).mockResolvedValue('fresh-token');

    await expect(apiClient.get('/test')).rejects.toThrow();
    expect(mock.history.get.length).toBe(2); // original + one retry only
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
