import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import GazeSession from './GazeSession';
import SpeechSession from './SpeechSession';
import { gazeApi, healthApi } from '../services/api';
vi.mock('../services/api',()=>({gazeApi:{status:vi.fn()},healthApi:{get:vi.fn().mockResolvedValue({status:'ok',modalities:{}})}}));
it('unavailable gaze is explicitly skipped without reporting completed analysis', async()=>{
  gazeApi.status.mockResolvedValue({available:false,openface_available:false});
  const skip=vi.fn(), complete=vi.fn();
  render(<GazeSession onSkip={skip} onComplete={complete} category='child'/>);
  fireEvent.click(await screen.findByRole('button',{name:'Continue without gaze (service unavailable)'}));
  expect(skip).toHaveBeenCalledWith('service_unavailable');
  expect(complete).not.toHaveBeenCalled();
});
it('denied microphone can be skipped without inventing an audio sample', async()=>{
  const getUserMedia=vi.fn().mockRejectedValue(Object.assign(new Error('denied'),{name:'NotAllowedError'}));
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia}});
  const skip=vi.fn(), complete=vi.fn();
  render(<SpeechSession onSkip={skip} onComplete={complete}/>);
  fireEvent.click(screen.getByRole('button',{name:/Start recording/i}));
  await waitFor(()=>expect(getUserMedia).toHaveBeenCalled());
  fireEvent.click(await screen.findByRole('button',{name:/Skip instead/i}));
  expect(skip).toHaveBeenCalled(); expect(complete).not.toHaveBeenCalled();
});

it('backend failure prevents microphone access and permits explicit skip',async()=>{
 healthApi.get.mockRejectedValueOnce(new Error('Backend unavailable'));
 const getUserMedia=vi.fn();Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia}});
 const skip=vi.fn();render(<SpeechSession onSkip={skip} onComplete={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:/Start recording/i}));
 fireEvent.click(await screen.findByRole('button',{name:/Skip instead/i}));
 expect(skip).toHaveBeenCalled();expect(getUserMedia).not.toHaveBeenCalled();
});
