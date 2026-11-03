import {it,expect,vi} from 'vitest';
import {FaceTracker,waitForVideo} from './tracker';
it('stops a camera acquired after the owner left',async()=>{
 Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
 let resolve;const pending=new Promise(r=>{resolve=r;});
 Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>pending}});
 const stop=vi.fn();const t=new FaceTracker(vi.fn());const start=t.start({});t.stop();resolve({getTracks:()=>[{stop}]});await start;
 expect(stop).toHaveBeenCalledOnce();expect(t.running).toBe(false);
});
it('aborts video readiness wait without leaving its timeout running',async()=>{
 const c=new AbortController();const pending=waitForVideo({},8000,c.signal);c.abort();
 await expect(pending).rejects.toMatchObject({code:'STOPPED'});
});

it.each([['NotAllowedError','CAMERA_PERMISSION_DENIED'],['NotFoundError','NO_CAMERA'],['NotReadableError','CAMERA_IN_USE']])('reports %s without fabricating a camera stream',async(name,code)=>{
 const {openCamera}=await import('./tracker');
 Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
 Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>Promise.reject(Object.assign(new Error('fixture'),{name}))}});
 await expect(openCamera()).rejects.toMatchObject({code});
});
