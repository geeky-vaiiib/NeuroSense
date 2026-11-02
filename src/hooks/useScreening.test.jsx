import { renderHook, act } from '@testing-library/react';
import { vi, it, expect } from 'vitest';
import { useScreening } from './useScreening';
import { screeningApi } from '../services/api';
vi.mock('../services/api', () => ({ screeningApi: { submit: vi.fn() } }));
it('reuses a request key after an ambiguous failure and changes it after editing', async () => {
  screeningApi.submit.mockRejectedValueOnce(new Error('timeout')).mockResolvedValue({caseId:'saved'});
  const {result}=renderHook(useScreening);
  const body={category:'adult',answers:{A1:'Definitely agree'}};
  await act(async()=>{await result.current.submit(body).catch(()=>{});});
  expect(result.current.error).toBe('timeout');
  await act(async()=>{await result.current.submit(body);});
  expect(screeningApi.submit.mock.calls[0][1]).toBe(screeningApi.submit.mock.calls[1][1]);
  await act(async()=>{await result.current.submit({...body, answers:{A1:'Definitely disagree'}});});
  expect(screeningApi.submit.mock.calls[2][1]).not.toBe(screeningApi.submit.mock.calls[1][1]);
});
