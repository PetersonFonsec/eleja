import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
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
  @Input() comparisonSelected = false;
  @Input() comparisonDisabled = false;
  @Output() readonly comparisonToggle = new EventEmitter<string>();
  readonly imageFailed = signal(false);

  candidateRoute(): string[] {
    return ['/candidates', this.candidate.id];
  }

  onImageError(): void {
    this.imageFailed.set(true);
  }

  toggleComparison(): void {
    if (!this.comparisonDisabled || this.comparisonSelected) {
      this.comparisonToggle.emit(this.candidate.id);
    }
  }
}
