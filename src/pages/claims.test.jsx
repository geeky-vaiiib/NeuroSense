import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {it, expect, vi} from 'vitest';
import Landing from './Landing';
import GazeLab from './GazeLab';
vi.mock('../context/AuthContext',()=>({useAuth:()=>({user:null,isAuthenticated:false,logout:vi.fn()})}));
vi.mock('../services/api',()=>({gazeApi:{labSessions:vi.fn(async()=>({sessions:[],validation:{passed:true}}))}}));
vi.mock('../components/GazeSession',()=>({default:()=> <div>Controlled recording boundary</div>}));

it('public diagram describes report assembly, not diagnostic fusion or calibrated gaze',()=>{
 render(<MemoryRouter><Landing/></MemoryRouter>);
 expect(screen.getByRole('img',{name:/Only the questionnaire determines screening/})).toBeInTheDocument();
 expect(screen.getByText(/their model scores are not combined/)).toBeInTheDocument();
 expect(screen.getByText(/There is no screen-position calibration/)).toBeInTheDocument();
 expect(document.body.textContent).not.toMatch(/MULTIMODAL FUSION|Fusion → screening insight|Calibration quality|only then combined/);
});
it('even a passed lab domain check never claims screening eligibility',async()=>{
 render(<GazeLab/>);
 expect(await screen.findByText('PASSED — gaze remains excluded from screening')).toBeVisible();
 expect(document.body.textContent).not.toMatch(/gaze counts in fusion|Until it passes/);
});
