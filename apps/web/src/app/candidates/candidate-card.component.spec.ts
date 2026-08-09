import '@angular/compiler';
import { describe, expect, it } from 'vitest';
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
});
