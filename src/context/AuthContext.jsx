/**
 * AuthContext.jsx
 * Global authentication state backed by the FastAPI server.
 *
 * - The server verifies credentials and issues the session as an HttpOnly cookie; this code
 *   never sees, generates or stores a token.
 * - `isAuthenticated` is true only after GET /auth/me succeeded (or login/register returned a user).
 * - Any 401 from the API client (expired/revoked session) emits SESSION_EXPIRED_EVENT, which
 *   clears the user here so ProtectedRoute redirects to /auth.
 */

/* eslint-disable react-refresh/only-export-components */

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { SESSION_EXPIRED_EVENT, authApi } from '../services/api';

const ROLE_LABELS = { clinician: 'Clinician', user: 'User' };

export function toSessionUser(apiUser) {
  const name = apiUser.name || '';
  return {
    ...apiUser,
    roleLabel: ROLE_LABELS[apiUser.role] || apiUser.role,
    initials: name.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2) || 'U',
    joinedAt: apiUser.created_at ? apiUser.created_at.slice(0, 10) : null,
  };
}

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true, // true until the first session check completes
  error: null,
  expired: false,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'SESSION':
      return { user: action.user, isAuthenticated: true, isLoading: false, error: null, expired: false };
    case 'ANONYMOUS':
      return { ...initialState, isLoading: false, expired: Boolean(action.expired), error: action.error ?? null };
    case 'LOADING':
      return { ...state, isLoading: true, error: null };
    case 'ERROR':
      return { ...state, isLoading: false, error: action.error };
    default:
      return state;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Session restoration: ask the server who we are.
  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((u) => !cancelled && dispatch({ type: 'SESSION', user: toSessionUser(u) }))
      .catch((err) => {
        if (cancelled) return;
        dispatch({
          type: 'ANONYMOUS',
          error: err.status === 401 ? null : 'Could not reach the server to verify your session.',
        });
      });
    return () => { cancelled = true; };
  }, []);

  // The API client reports a dead session (expired, revoked, deactivated).
  useEffect(() => {
    const onExpired = () => dispatch({ type: 'ANONYMOUS', expired: true });
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (email, password) => {
    dispatch({ type: 'LOADING' });
    try {
      const { user } = await authApi.login({ email, password });
      dispatch({ type: 'SESSION', user: toSessionUser(user) });
      return true;
    } catch (err) {
      dispatch({ type: 'ERROR', error: err.message });
      return false;
    }
  }, []);

  const register = useCallback(async ({ name, email, password }) => {
    dispatch({ type: 'LOADING' });
    try {
      const { user } = await authApi.register({ name, email, password });
      dispatch({ type: 'SESSION', user: toSessionUser(user) });
      return true;
    } catch (err) {
      dispatch({ type: 'ERROR', error: err.message });
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout(); // server revokes the token and clears the cookie
    } catch {
      // Already expired/unreachable: the local session is cleared regardless.
    }
    dispatch({ type: 'ANONYMOUS' });
  }, []);

  const clearError = useCallback(() => dispatch({ type: 'ERROR', error: null }), []);

  const value = useMemo(
    () => ({ ...state, login, register, logout, clearError }),
    [state, login, register, logout, clearError]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
