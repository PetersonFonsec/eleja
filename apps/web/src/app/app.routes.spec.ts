import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { DashboardPageComponent } from './analytics/dashboard-page.component';
import { routes } from './app.routes';

describe('application routes', () => {
  it('registers the public dashboard route', () => {
    expect(routes.find((route) => route.path === 'dashboard')?.component).toBe(
      DashboardPageComponent,
    );
  });
});
