import {it,expect,vi,afterEach} from 'vitest';
const mock=vi.hoisted(()=>({get:vi.fn()}));
vi.mock('axios',()=>({default:{create:()=>({get:mock.get,interceptors:{response:{use:vi.fn()}}})}}));
import {gazeApi,gazeDelay} from './api';
afterEach(()=>vi.restoreAllMocks());
it('aborts a polling delay immediately',async()=>{
 const c=new AbortController(); const pending=gazeDelay(100000,c.signal); c.abort();
 await expect(pending).rejects.toMatchObject({kind:'cancelled'});
});
it('resumes an accepted job without uploading again',async()=>{
 const fetch=vi.spyOn(globalThis,'fetch');
 const get=mock.get.mockResolvedValue({state:'done',stage:'complete',result:{modality:'gaze',status:'out_of_domain',probability:null}});
 const result=await gazeApi.analyze({jobId:'accepted'});
 expect(fetch).not.toHaveBeenCalled();expect(result.job_id).toBe('accepted');expect(get.mock.calls[0][1]).toHaveProperty('signal');
});
it('does not retry an ambiguous upload',async()=>{
 const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(new TypeError('offline'));
 await expect(gazeApi.analyze({blob:new Blob(['fixture'],{type:'video/webm'}),durationMs:30000})).rejects.toMatchObject({kind:'upload_unknown'});
 expect(fetch).toHaveBeenCalledTimes(1);
});
it('honors abort before upload',async()=>{
 const c=new AbortController(); c.abort();
 await expect(gazeApi.analyze({signal:c.signal})).rejects.toMatchObject({kind:'cancelled'});
});
it('aborts an active polling request with stopped-waiting semantics',async()=>{
 const c=new AbortController();mock.get.mockImplementationOnce((url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('cancelled')))));
 const pending=gazeApi.analyze({jobId:'accepted',signal:c.signal});c.abort();await expect(pending).rejects.toMatchObject({kind:'cancelled'});
});
it('exposes accepted ID before a transient polling failure',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{"job_id":"accepted"}',{status:202}));
 mock.get.mockRejectedValueOnce(Object.assign(new Error('offline'),{kind:'network'}));const accepted=vi.fn();
 await expect(gazeApi.analyze({blob:new Blob(['fixture'],{type:'video/webm'}),durationMs:30000,onAccepted:accepted})).rejects.toMatchObject({kind:'network'});
 expect(accepted).toHaveBeenCalledWith('accepted');
});
