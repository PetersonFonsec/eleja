import {
  ChangeDetectionStrategy,
  Component,
  Input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CandidateListItem } from './candidate.types';

@Component({
  selector: 'app-candidate-card',
  imports: [RouterLink],
  templateUrl: './candidate-card.component.html',
  styleUrl: './candidate-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CandidateCardComponent {
  @Input({ required: true }) candidate!: CandidateListItem;
  readonly imageFailed = signal(false);

  candidateRoute(): string[] {
    return ['/candidates', this.candidate.id];
  }

  onImageError(): void {
    this.imageFailed.set(true);
  }
}
