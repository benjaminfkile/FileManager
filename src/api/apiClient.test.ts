import MockAdapter from 'axios-mock-adapter';
import apiClient, { API_KEY_STORAGE_KEY } from './apiClient';

const mock = new MockAdapter(apiClient);

afterEach(() => {
  mock.reset();
  localStorage.clear();
});

describe('apiClient interceptor', () => {
  it('attaches x-api-key header when localStorage has a key', async () => {
    localStorage.setItem(API_KEY_STORAGE_KEY, 'test-api-key-123');
    mock.onGet('/test').reply(200, { ok: true });

    const response = await apiClient.get('/test');

    expect(response.status).toBe(200);
    expect(mock.history.get[0].headers!['x-api-key']).toBe('test-api-key-123');
  });

  it('does not attach x-api-key header when localStorage returns null', async () => {
    mock.onGet('/test').reply(200, { ok: true });

    const response = await apiClient.get('/test');

    expect(response.status).toBe(200);
    expect(mock.history.get[0].headers!['x-api-key']).toBeUndefined();
  });
});

describe('API_KEY_STORAGE_KEY', () => {
  it('equals "fm_api_key"', () => {
    expect(API_KEY_STORAGE_KEY).toBe('fm_api_key');
  });
});
