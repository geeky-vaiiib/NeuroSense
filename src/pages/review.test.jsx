import {render,screen,fireEvent} from '@testing-library/react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {it,expect,vi} from 'vitest';
import Screening from './Screening';
vi.mock('../components/GazeSession',()=>({default:({onSkip})=><button onClick={()=>onSkip('fixture')}>Skip gaze fixture</button>}));
vi.mock('../components/SpeechSession',()=>({default:({onSkip})=><button onClick={onSkip}>Skip speech fixture</button>}));
vi.mock('../components/FacialSession',()=>({default:({onSkip})=><button onClick={onSkip}>Skip facial fixture</button>}));
vi.mock('../services/api',()=>({screeningApi:{submit:vi.fn()}}));
it('reviews every adult answer and edits the requested question without repeating recording steps',()=>{
 render(<MemoryRouter initialEntries={['/app/screening/adult']}><Routes><Route path='/app/screening/:category' element={<Screening/>}/></Routes></MemoryRouter>);
 for(const b of screen.getAllByRole('checkbox')) fireEvent.click(b);
 fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 fireEvent.change(screen.getByLabelText('Your age'),{target:{value:'30'}});
 fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 for(let i=1;i<=10;i++) {
   fireEvent.click(screen.getByRole('button',{name:new RegExp(`^Go to question ${i}(?: |$)`)}));
   fireEvent.click(screen.getByRole('radio',{name:'Definitely agree',exact:true}));
 }
 fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 for(const name of ['Skip gaze fixture','Skip speech fixture','Skip facial fixture']) fireEvent.click(screen.getByRole('button',{name}));
 expect(screen.getByRole('list',{name:'Answers to review'}).children).toHaveLength(10);
 fireEvent.click(screen.getByRole('button',{name:'Change answer to question 5',exact:true}));
 expect(screen.getByRole('heading',{level:2})).toHaveTextContent('read between the lines');
 fireEvent.click(screen.getByRole('radio',{name:'Definitely disagree',exact:true}));
 fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 expect(screen.getByRole('list',{name:'Answers to review'})).toHaveTextContent('Definitely disagree');
 expect(screen.getByRole('button',{name:'Submit adult screening'})).toBeInTheDocument();
 expect(screen.queryByText('Skip gaze fixture')).not.toBeInTheDocument();
});
