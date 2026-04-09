import MockAdapter from 'axios-mock-adapter';
import apiClient from './apiClient';
import { getIdToken } from '../lib/cognitoClient';

jest.mock('../lib/cognitoClient');
const mockGetIdToken = getIdToken as jest.MockedFunction<typeof getIdToken>;

const mock = new MockAdapter(apiClient);

afterEach(() => {
  mock.reset();
  jest.resetAllMocks();
});

describe('apiClient interceptor', () => {
  it('attaches Authorization Bearer header when a token is available', async () => {
    mockGetIdToken.mockResolvedValue('test-jwt-token');
    mock.onGet('/test').reply(200, { ok: true });

    const response = await apiClient.get('/test');

    expect(response.status).toBe(200);
    expect(mock.history.get[0].headers!['Authorization']).toBe('Bearer test-jwt-token');
  });

  it('does not attach Authorization header when no token is available', async () => {
    mockGetIdToken.mockResolvedValue(null);
    mock.onGet('/test').reply(200, { ok: true });

    const response = await apiClient.get('/test');

    expect(response.status).toBe(200);
    expect(mock.history.get[0].headers!['Authorization']).toBeUndefined();
  });
});
