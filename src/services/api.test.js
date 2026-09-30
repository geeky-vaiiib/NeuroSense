import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SESSION_EXPIRED_EVENT, authFetch } from './api';

describe('authFetch', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends the session cookie and CSRF header, never an Authorization header', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    await authFetch('/cases/', { method: 'GET' });
    const [, init] = spy.mock.calls[0];
    expect(init.credentials).toBe('include');
    expect(init.headers['X-Requested-With']).toBe('NeuroSense');
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('emits a session-expired event on 401 for data routes but not for login', async () => {
    const handler = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, handler);
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response('{}', { status: 401 })));
    await authFetch('/auth/login', { method: 'POST' });
    expect(handler).not.toHaveBeenCalled();
    await authFetch('/screening/screen', { method: 'POST' });
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
  });

  it('keeps no token in web storage', () => {
    expect(localStorage.getItem('neurosense_token')).toBeNull();
    expect(localStorage.getItem('ns_session')).toBeNull();
  });
});

import { ApiError, apiErrorFromStatus, casesApi, screeningApi } from './api';

describe('error mapping', () => {
  it.each([
    [401, 'unauthenticated'], [403, 'forbidden'], [404, 'not_found'], [422, 'validation'],
    [429, 'rate_limited'], [500, 'server'], [503, 'server'],
  ])('status %i -> %s', (status, kind) => {
    const e = apiErrorFromStatus(status, { detail: 'x' });
    expect(e).toBeInstanceOf(ApiError);
    expect(e.kind).toBe(kind);
  });

  it('never shows raw server internals for 5xx', () => {
    expect(apiErrorFromStatus(500, { detail: 'Traceback: secret path /srv' }).message).not.toMatch(/Traceback/);
  });
});

describe('no fake results when the backend fails', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('screening submit rejects with a network ApiError instead of returning a mock result', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await screeningApi.submit({ category: 'child', demo: {}, answers: {}, aq10Score: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe('network');
    expect(err.message).toMatch(/unable to connect/i);
  });

  it('screening submit maps a timeout (abort) to kind=timeout', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const err = await screeningApi.submit({ category: 'child', demo: {}, answers: {}, aq10Score: 1 }).catch((e) => e);
    expect(err.kind).toBe('timeout');
  });

  it('a 500 from screening is an error, not data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"detail":"boom"}', { status: 500 }));
    const err = await screeningApi.submit({ category: 'child', demo: {}, answers: {}, aq10Score: 1 }).catch((e) => e);
    expect(err.kind).toBe('server');
  });

  it('cases list rejects instead of returning mock cases', async () => {
    const err = await casesApi.list().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    // 'network'/'timeout' when no backend runs; 'unauthenticated' when one does (no session) -- never data
    expect(['network', 'timeout', 'unauthenticated']).toContain(err.kind);
  });
});
