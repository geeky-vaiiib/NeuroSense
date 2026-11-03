import {render,screen,fireEvent,act} from '@testing-library/react';
import {vi,it,expect,afterEach} from 'vitest';
import GazeSession from './GazeSession';
import {gazeApi} from '../services/api';
const state=vi.hoisted(()=>({tracker:null,recorder:null}));
vi.mock('../services/api',()=>({gazeApi:{status:vi.fn(async()=>({available:true,openface_available:true})),analyze:vi.fn()}}));
vi.mock('../gaze/tracker',()=>({LOW_LIGHT:45,TrackerError:class extends Error{},FaceTracker:class{
 constructor(cb){this.cb=cb;this.track={stop:vi.fn()};this.stream={getTracks:()=>[this.track]};state.tracker=this;this.stop=vi.fn();}
 async start(){} stop(){}
}}));
class Recorder{
 static isTypeSupported(){return true;}
 constructor(){this.state='inactive';this.mimeType='video/webm';state.recorder=this;}
 start(){this.state='recording';}
 stop(){this.state='inactive';this.onstop?.();}
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.clearAllMocks();gazeApi.analyze.mockReset();});
async function setup(){
 vi.stubGlobal('MediaRecorder',Recorder);vi.useFakeTimers();
 const result=render(<GazeSession onSkip={vi.fn()} onComplete={vi.fn()}/>);
 await act(async()=>{});
 fireEvent.click(screen.getByRole('button',{name:'Start camera check'}));await act(async()=>{});
 act(()=>{state.tracker.cb({ok:true,fps:30,luma:100});vi.advanceTimersByTime(1300);state.tracker.cb({ok:true,fps:30,luma:100});});
 fireEvent.click(screen.getByRole('button',{name:'Start the 30-second task'}));
 return result;
}
it('countdown unmount stops recorder/trackers without upload',async()=>{
 const view=await setup();const tr=state.tracker;view.unmount();
 act(()=>vi.advanceTimersByTime(40000));expect(tr.stop).toHaveBeenCalled();expect(gazeApi.analyze).not.toHaveBeenCalled();
});
it('recording unmount cannot upload a partial file',async()=>{
 const view=await setup();act(()=>vi.advanceTimersByTime(3000));expect(state.recorder.state).toBe('recording');
 view.unmount();expect(state.recorder.state).toBe('inactive');expect(state.recorder.onstop).toBeNull();expect(gazeApi.analyze).not.toHaveBeenCalled();
});
it('skip during countdown discards callbacks',async()=>{
 await setup();fireEvent.click(screen.getByRole('button',{name:/Skip this step/}));act(()=>vi.advanceTimersByTime(40000));expect(gazeApi.analyze).not.toHaveBeenCalled();
});
it('recorder errors discard partial capture',async()=>{
 await setup();act(()=>vi.advanceTimersByTime(3000));act(()=>state.recorder.onerror());
 expect(screen.getByRole('alert')).toHaveTextContent('Recording failed');expect(gazeApi.analyze).not.toHaveBeenCalled();
});
it('backgrounding discards recording instead of extending timing',async()=>{
 await setup();act(()=>vi.advanceTimersByTime(3000));
 Object.defineProperty(document,'hidden',{configurable:true,value:true});
 fireEvent(document,new Event('visibilitychange'));
 expect(screen.getByRole('alert')).toHaveTextContent('tab was hidden');expect(gazeApi.analyze).not.toHaveBeenCalled();
 Object.defineProperty(document,'hidden',{configurable:true,value:false});
});
it('a polling failure resumes the same accepted job',async()=>{
 gazeApi.analyze.mockImplementationOnce(async({onAccepted})=>{onAccepted('accepted');throw Object.assign(new Error('network failed'),{kind:'network'});});
 await setup();act(()=>vi.advanceTimersByTime(3000));
 act(()=>state.recorder.ondataavailable({data:new Blob(['fixture'])}));
 await act(async()=>vi.advanceTimersByTime(30000));
 expect(screen.getByRole('alert')).toHaveTextContent('network failed');
 gazeApi.analyze.mockResolvedValueOnce({job_id:'accepted',status:'unavailable',reason:'openface_unavailable',quality:null});
 fireEvent.click(screen.getByRole('button',{name:'Resume accepted analysis'}));await act(async()=>{});
 expect(gazeApi.analyze.mock.calls[1][0].jobId).toBe('accepted');expect(gazeApi.analyze.mock.calls[1][0].blob).toBeNull();
});
it('late upload results cannot resurrect an abandoned attempt',async()=>{
 let resolve;gazeApi.analyze.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
 await setup();act(()=>vi.advanceTimersByTime(3000));await act(async()=>vi.advanceTimersByTime(30000));
 fireEvent.click(screen.getByRole('button',{name:'Stop waiting'}));
 await act(async()=>resolve({status:'success',quality:{sample_count:450}}));
 expect(screen.getByRole('alert')).toHaveTextContent('Stopped waiting');
 expect(screen.queryByText('Gaze recording analysed')).not.toBeInTheDocument();
});
it('unexpected recorder stop releases camera and never uploads',async()=>{
 await setup();act(()=>vi.advanceTimersByTime(3000));const tr=state.tracker;
 act(()=>state.recorder.stop());expect(tr.stop).toHaveBeenCalled();expect(gazeApi.analyze).not.toHaveBeenCalled();
 expect(screen.getByRole('alert')).toHaveTextContent('ended early');
});
it('camera track ending discards partial capture',async()=>{
 await setup();act(()=>vi.advanceTimersByTime(3000));act(()=>state.tracker.track.onended());
 expect(screen.getByRole('alert')).toHaveTextContent('Camera disconnected');expect(gazeApi.analyze).not.toHaveBeenCalled();
});
it('delayed task timers discard overlong captures',async()=>{
 await setup();act(()=>vi.advanceTimersByTime(3000));
 const clock=vi.spyOn(performance,'now').mockReturnValue(100000);
 act(()=>vi.advanceTimersByTime(200));clock.mockRestore();
 expect(screen.getByRole('alert')).toHaveTextContent('timers were delayed');expect(gazeApi.analyze).not.toHaveBeenCalled();
});
