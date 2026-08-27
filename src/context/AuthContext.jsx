/**
 * AuthContext.jsx
 * Global authentication state via React Context + useReducer.
 * Mock auth — no real backend required; stores session in localStorage.
 */

/* eslint-disable react-refresh/only-export-components */

import { createContext, useCallback, useContext, useEffect, useReducer } from 'react';

/* ── Types ───────────────────────────────────────────────── */
const AUTH_ACTIONS = {
  INIT:     'INIT',
  LOGIN:    'LOGIN',
  LOGOUT:   'LOGOUT',
  REGISTER: 'REGISTER',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR:   'SET_ERROR',
};

const initialState = {
  user:            null,
  token:           null,
  isAuthenticated: false,
  isLoading:       true,   // true on first mount while checking localStorage
  error:           null,
};

/* ── Reducer ─────────────────────────────────────────────── */
function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.INIT:
      return { ...state, ...action.payload, isLoading: false };

    case AUTH_ACTIONS.LOGIN:
    case AUTH_ACTIONS.REGISTER:
      return {
        ...state,
        user:            action.payload.user,
        token:           action.payload.token,
        isAuthenticated: true,
        isLoading:       false,
        error:           null,
      };

    case AUTH_ACTIONS.LOGOUT:
      return { ...initialState, isLoading: false };

    case AUTH_ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload };

    case AUTH_ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };

    default:
      return state;
  }
}

/* ── Mock user database ──────────────────────────────────── */
const MOCK_USERS = [
  {
    id:        'usr-001',
    name:      'Dr. Priya Mehta',
    email:     'priya@neurosense.health',
    password:  'demo1234',
    role:      'Senior Clinician',
    specialty: 'Autism Spectrum',
    initials:  'PM',
    joinedAt:  '2024-01-15',
  },
  {
    id:        'usr-002',
    name:      'Dr. Lena Torres',
    email:     'lena@neurosense.health',
    password:  'demo1234',
    role:      'Clinical Psychologist',
    specialty: 'ADHD & Executive Function',
    initials:  'LT',
    joinedAt:  '2024-03-02',
  },
];

function generateToken() {
  return `ns_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function sanitizeUser(user) {
  const safe = { ...user };
  delete safe.password;
  return safe;
}

/* ── Context ─────────────────────────────────────────────── */
const AuthContext = createContext(null);

/* ── Provider ────────────────────────────────────────────── */
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ns_session');
      if (stored) {
        const { user, token } = JSON.parse(stored);
        dispatch({
          type:    AUTH_ACTIONS.INIT,
          payload: { user, token, isAuthenticated: true },
        });
      } else {
        dispatch({ type: AUTH_ACTIONS.INIT, payload: { isAuthenticated: false } });
      }
    } catch {
      dispatch({ type: AUTH_ACTIONS.INIT, payload: { isAuthenticated: false } });
    }
  }, []);

  /* ── login ───────────────────────────────────────────── */
  const login = useCallback(async (email, password) => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    dispatch({ type: AUTH_ACTIONS.SET_ERROR,   payload: null });

    // Simulate network latency
    await new Promise((r) => setTimeout(r, 700));

    const found = MOCK_USERS.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (!found) {
      dispatch({
        type:    AUTH_ACTIONS.SET_ERROR,
        payload: 'Invalid email or password.',
      });
      return false;
    }

    const token = generateToken();
    const user  = sanitizeUser(found);

    localStorage.setItem('ns_session', JSON.stringify({ user, token }));
    dispatch({ type: AUTH_ACTIONS.LOGIN, payload: { user, token } });
    return true;
  }, []);

  /* ── register ────────────────────────────────────────── */
  const register = useCallback(async ({ name, email, password, role }) => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    dispatch({ type: AUTH_ACTIONS.SET_ERROR,   payload: null });

    await new Promise((r) => setTimeout(r, 800));

    // Check duplicate
    if (MOCK_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
      dispatch({
        type:    AUTH_ACTIONS.SET_ERROR,
        payload: 'An account with this email already exists.',
      });
      return false;
    }

    const token = generateToken();
    const rawUser = {
      id:        `usr-${Date.now()}`,
      name,
      email,
      password,
      role:      role || 'Clinician',
      specialty: 'General',
      initials:  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2),
      joinedAt:  new Date().toISOString().split('T')[0],
    };
    const user = sanitizeUser(rawUser);

    localStorage.setItem('ns_session', JSON.stringify({ user, token }));
    dispatch({ type: AUTH_ACTIONS.REGISTER, payload: { user, token } });
    return true;
  }, []);

  /* ── demo login ──────────────────────────────────────── */
  const loginAsDemo = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 400));
    const token = generateToken();
    const user  = sanitizeUser(MOCK_USERS[0]);
    localStorage.setItem('ns_session', JSON.stringify({ user, token }));
    dispatch({ type: AUTH_ACTIONS.LOGIN, payload: { user, token } });
  }, []);

  /* ── logout ──────────────────────────────────────────── */
  const logout = useCallback(() => {
    localStorage.removeItem('ns_session');
    dispatch({ type: AUTH_ACTIONS.LOGOUT });
  }, []);

  /* ── clear error ─────────────────────────────────────── */
  const clearError = useCallback(() => {
    dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: null });
  }, []);

  const value = {
    ...state,
    login,
    register,
    loginAsDemo,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ── Consumer hook ───────────────────────────────────────── */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
