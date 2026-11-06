import { useEffect, useState } from 'react';
import { useDraftOwner } from '../context/AuthContext';
import { readDraft, writeDraft } from '../utils/flowDrafts';
export function useDraftState(track, field, initial) {
  const owner = useDraftOwner();
  const [value, setValue] = useState(() => readDraft(owner, track, field) ?? (typeof initial === 'function' ? initial() : initial));
  useEffect(() => { writeDraft(owner, track, field, value); }, [owner, track, field, value]);
  return [value, setValue];
}
