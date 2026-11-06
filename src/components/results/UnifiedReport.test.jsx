import { render, screen, fireEvent } from '@testing-library/react';
import { it, expect } from 'vitest';
import UnifiedReport from './UnifiedReport';
import fixtures from '../../test/fixtures/resultsReports.json';
for(const key of Object.keys(fixtures))it(`${key}: calm summary hides technical values until requested`,()=>{
 const report=fixtures[key];render(<UnifiedReport report={report}/>);
 expect(screen.getByRole('heading',{level:1})).toHaveTextContent('Your screening summary');
 expect(screen.getByText(report.presentation.score_text)).toBeVisible();
 const technical=screen.getByTestId('technical-details');expect(technical).not.toHaveAttribute('open');
 for(const card of report.modalities)for(const row of card.values || []) {
  const nodes=screen.queryAllByText(`${row.display_label || row.name}: ${row.text}`);for(const node of nodes)expect(node).not.toBeVisible();
 }
 fireEvent.click(screen.getByText('Technical details',{exact:true}));expect(technical).toHaveAttribute('open');
 if(key==='partial')expect(screen.getByText(/QA-HASH/)).toBeVisible();
 if(key==='example')expect(screen.getByRole('note')).toHaveTextContent('separate dataset participants');
});
