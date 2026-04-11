import MockAdapter from 'axios-mock-adapter';
import apiClient from './apiClient';
import { registerUser, getMe, searchUsers, RegisterPayload } from './userService';
import { IUser } from '../types';

const mock = new MockAdapter(apiClient);

afterEach(() => {
  mock.reset();
});

const fakeUser: IUser = {
  id: 'u-1',
  first_name: 'John',
  last_name: 'Doe',
  username: 'johndoe',
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('registerUser', () => {
  it('POSTs to /api/users/register with the correct payload', async () => {
    const payload: RegisterPayload = {
      first_name: 'John',
      last_name: 'Doe',
      username: 'johndoe',
    };

    mock.onPost('/api/users/register').reply(201, fakeUser);

    const result = await registerUser(payload);

    expect(result).toEqual(fakeUser);
    expect(mock.history.post).toHaveLength(1);
    expect(JSON.parse(mock.history.post[0].data)).toEqual(payload);
  });
});

describe('getMe', () => {
  it('GETs /api/users/me and returns IUser', async () => {
    mock.onGet('/api/users/me').reply(200, { status: 'ok', error: false, data: fakeUser });

    const result = await getMe();

    expect(result).toEqual(fakeUser);
    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].url).toBe('/api/users/me');
  });
});

describe('searchUsers', () => {
  it('GETs /api/users/search?q=foo and returns IUser[]', async () => {
    const users: IUser[] = [fakeUser];

    mock.onGet('/api/users/search', { params: { q: 'foo' } }).reply(200, { data: users });

    const result = await searchUsers('foo');

    expect(result).toEqual(users);
    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].params).toEqual({ q: 'foo' });
  });
});
