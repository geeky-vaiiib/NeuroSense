import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { it, expect, vi } from 'vitest';
import Screening from './Screening';
import { validateCategoryAge, QUESTION_BANK } from '../data/screeningContent';
import { routeForAge } from '../data/toddler';
vi.mock('../services/api',()=>({screeningApi:{submit:vi.fn()},gazeApi:{status:vi.fn()}}));
it('adult routing, wording and age guard use the adult track',()=>{
  expect(routeForAge(30,'years').track).toBe('adult');
  expect(validateCategoryAge('adult',30).valid).toBe(true);
  expect(validateCategoryAge('adult',17).valid).toBe(false);
  expect(validateCategoryAge('child',8).valid).toBe(true);
  expect(QUESTION_BANK.adult[4].prompt).toContain('read between the lines');
  render(<MemoryRouter initialEntries={['/app/screening/adult']}><Routes><Route path='/app/screening/:category' element={<Screening/>}/></Routes></MemoryRouter>);
  expect(screen.getByRole('heading',{name:'Adult consent and privacy'})).toBeInTheDocument();
  for(const b of screen.getAllByRole('checkbox')) fireEvent.click(b);
  fireEvent.click(screen.getByRole('button',{name:'Continue'}));
  fireEvent.change(screen.getByLabelText('Your age'),{target:{value:'17'}});
  fireEvent.click(screen.getByRole('button',{name:'Continue'}));
  expect(screen.getByRole('alert')).toHaveTextContent('18 to 120');
});

it('manual question navigation cancels pending auto-advance', async()=>{
  vi.useFakeTimers();
  const {default:QuestionFlow}=await import('../components/screening/QuestionFlow');
  const onAnswer=vi.fn();
  render(<QuestionFlow questions={QUESTION_BANK.adult} answers={{}} onAnswer={onAnswer} options={['Definitely agree']}/>);
  fireEvent.click(screen.getByRole('radio'));
  fireEvent.click(screen.getByRole('button',{name:'Go to question 5'}));
  const {act}=await import('@testing-library/react');
  act(()=>vi.advanceTimersByTime(400));
  expect(screen.getByRole('heading')).toHaveTextContent('read between the lines');
  vi.useRealTimers();
});
