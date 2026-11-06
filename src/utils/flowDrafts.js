/** Tab-memory recovery only. Never write recordings, answers or tokens to browser storage.
 * Scoped to the server-authenticated owner; cleared on explicit logout/success or page close.
 */
const drafts = new Map();
const attempts = new Map();
export function readDraft(owner, track, field) { return owner ? drafts.get(`${owner}:${track}`)?.[field] : undefined; }
export function writeDraft(owner, track, field, value) {
  if (!owner) return;
  const key = `${owner}:${track}`;
  drafts.set(key, { ...drafts.get(key), [field]: value });
}
export function clearDraft(owner, track) { drafts.delete(`${owner}:${track}`); }
export function clearOwnerDrafts(owner) {
  for (const key of drafts.keys()) if (key.startsWith(`${owner}:`)) drafts.delete(key);
  attempts.delete(owner);
}
export function getAttempt(owner) { return owner ? attempts.get(owner) : null; }
export function saveAttempt(owner, attempt) { if (owner) attempts.set(owner, attempt); }
export function clearAttempt(owner) { attempts.delete(owner); }
