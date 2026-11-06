import { it, expect } from 'vitest';
import { readDraft, writeDraft, clearDraft, clearOwnerDrafts, getAttempt, saveAttempt } from './flowDrafts';
it('retains answers and accepted jobs only for the authenticated owner and clears explicit completion/logout',()=>{
 writeDraft('one','adult','answers',{A1:'Definitely agree'});writeDraft('one','adult','job','accepted');
 expect(readDraft('two','adult','answers')).toBeUndefined();expect(readDraft('one','child','answers')).toBeUndefined();
 expect(readDraft('one','adult','job')).toBe('accepted');expect(readDraft('one','adult','answers').A1).toBe('Definitely agree');
 saveAttempt('one',{signature:'body',key:'retry'});expect(getAttempt('two')).toBeUndefined();
 clearDraft('one','adult');expect(readDraft('one','adult','answers')).toBeUndefined();
 clearOwnerDrafts('one');expect(getAttempt('one')).toBeUndefined();
});
