import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  SESSION_EXPIRED_EVENT: 'ns:session-expired',
  authApi: { me: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn() },
}));

import { authApi } from '../services/api';
import { AuthProvider, useAuth } from './AuthContext';

const USER = { user_id: 'u1', name: 'Alice Smith', email: 'a@example.com', role: 'user', is_active: true, created_at: '2026-01-02T00:00:00Z' };
const unauth = () => Object.assign(new Error('Not authenticated'), { status: 401 });

function Probe() {
  const { user, isAuthenticated, isLoading, error, expired, login, register, logout } = useAuth();
  return (
    <div>
      <p data-testid="state">{isLoading ? 'loading' : isAuthenticated ? 'in' : 'out'}</p>
      <p data-testid="name">{user?.name ?? ''}</p>
      <p data-testid="initials">{user?.initials ?? ''}</p>
      <p data-testid="err">{error ?? ''}</p>
      <p data-testid="expired">{String(expired)}</p>
      <button onClick={() => login('a@example.com', 'pw')}>login</button>
      <button onClick={() => register({ name: 'Alice Smith', email: 'a@example.com', password: 'pw' })}>register</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

const mount = () => render(<AuthProvider><Probe /></AuthProvider>);

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe('session restoration', () => {
  it('is authenticated only when the server confirms the session', async () => {
    authApi.me.mockResolvedValue(USER);
    mount();
    expect(screen.getByTestId('state')).toHaveTextContent('loading');
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('in'));
    expect(screen.getByTestId('name')).toHaveTextContent('Alice Smith');
    expect(screen.getByTestId('initials')).toHaveTextContent('AS');
    expect(authApi.me).toHaveBeenCalledTimes(1);
  });

  it('ignores a forged localStorage session', async () => {
    localStorage.setItem('ns_session', JSON.stringify({ user: { name: 'Mallory' }, token: 'ns_fake_123' }));
    localStorage.setItem('authenticated', 'true');
    authApi.me.mockRejectedValue(unauth());
    mount();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('out'));
    expect(screen.getByTestId('name')).toHaveTextContent('');
  });

  it('reports an unreachable server instead of pretending to be logged in', async () => {
    authApi.me.mockRejectedValue(new Error('No response'));
    mount();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('out'));
    expect(screen.getByTestId('err')).toHaveTextContent(/could not reach/i);
  });
});

describe('login / register / logout', () => {
  beforeEach(() => { authApi.me.mockRejectedValue(unauth()); });

  it('logs in through the backend and stores nothing in web storage', async () => {
    authApi.login.mockResolvedValue({ user: USER });
    mount();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('out'));
    await userEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('in'));
    expect(authApi.login).toHaveBeenCalledWith({ email: 'a@example.com', password: 'pw' });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('shows the server error on bad credentials and stays logged out', async () => {
    authApi.login.mockRejectedValue(Object.assign(new Error('Invalid email or password.'), { status: 401 }));
    mount();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('out'));
    await userEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('err')).toHaveTextContent('Invalid email or password.'));
    expect(screen.getByTestId('state')).toHaveTextContent('out');
  });

  it('registers without sending a role', async () => {
    authApi.register.mockResolvedValue({ user: USER });
    mount();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('out'));
    await userEvent.click(screen.getByText('register'));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('in'));
    expect(authApi.register.mock.calls[0][0]).not.toHaveProperty('role');
  });

  it('logout calls the server and clears the user, even if the server call fails', async () => {
    authApi.login.mockResolvedValue({ user: USER });
    authApi.logout.mockRejectedValue(new Error('offline'));
    mount();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('out'));
    await userEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('in'));
    await userEvent.click(screen.getByText('logout'));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('out'));
    expect(authApi.logout).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('name')).toHaveTextContent('');
  });
});

describe('expired session', () => {
  it('drops the user when the API client reports a 401', async () => {
    authApi.me.mockResolvedValue(USER);
    mount();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('in'));
    act(() => { window.dispatchEvent(new Event('ns:session-expired')); });
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('out'));
    expect(screen.getByTestId('expired')).toHaveTextContent('true');
  });
});

describe('protected routes', () => {
  function Guard({ children }) {
    const { isAuthenticated, isLoading } = useAuth();
    if (isLoading) return <p>checking</p>;
    return isAuthenticated ? children : <p>redirected to /auth</p>;
  }
  const app = () => render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/app/cases']}>
        <Routes>
          <Route path="/app/cases" element={<Guard><p>secret cases</p></Guard>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );

  it('blocks anonymous users', async () => {
    authApi.me.mockRejectedValue(unauth());
    app();
    await waitFor(() => expect(screen.getByText('redirected to /auth')).toBeInTheDocument());
    expect(screen.queryByText('secret cases')).not.toBeInTheDocument();
  });

  it('admits a server-verified user', async () => {
    authApi.me.mockResolvedValue(USER);
    app();
    await waitFor(() => expect(screen.getByText('secret cases')).toBeInTheDocument());
  });
});
