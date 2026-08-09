import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { CandidateCardComponent } from './candidate-card.component';

describe('CandidateCardComponent', () => {
  it('prepares navigation to the candidate detail route', () => {
    const component = new CandidateCardComponent();
    component.candidate = { id: 'candidate-id' } as never;

    expect(component.candidateRoute()).toEqual(['/candidates', 'candidate-id']);
  });

  it('switches to the neutral placeholder after an image error', () => {
    const component = new CandidateCardComponent();
    component.onImageError();
    expect(component.imageFailed()).toBe(true);
  });

  it('emits an explicit comparison selection without changing detail navigation', () => {
    const component = new CandidateCardComponent();
    component.candidate = { id: 'candidate-id' } as never;
    const emit = vi.spyOn(component.comparisonToggle, 'emit');
    component.toggleComparison();
    expect(emit).toHaveBeenCalledWith('candidate-id');
    expect(component.candidateRoute()).toEqual(['/candidates', 'candidate-id']);
  });
});
