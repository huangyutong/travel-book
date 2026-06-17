import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ThemeService } from './services/theme.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  private removePointerMoveListener?: () => void;
  private pointerFrame: number | null = null;
  private pendingPointer: { x: number; y: number } | null = null;
  private rippleIdleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    public themeService: ThemeService,
    public authService: AuthService,
    private router: Router,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.zone.runOutsideAngular(() => {
      const listener = (event: PointerEvent) => this.handlePointerMove(event);
      window.addEventListener('pointermove', listener, { passive: true });
      this.removePointerMoveListener = () => window.removeEventListener('pointermove', listener);
    });
  }

  ngOnDestroy(): void {
    this.removePointerMoveListener?.();
    if (this.pointerFrame !== null) cancelAnimationFrame(this.pointerFrame);
    if (this.rippleIdleTimer) clearTimeout(this.rippleIdleTimer);
  }

  handlePointerMove(event: PointerEvent): void {
    this.pendingPointer = { x: event.clientX, y: event.clientY };
    if (this.pointerFrame !== null) return;

    this.pointerFrame = requestAnimationFrame(() => {
      this.pointerFrame = null;
      if (!this.pendingPointer) return;

      const { x, y } = this.pendingPointer;
      const rootStyle = document.documentElement.style;
      const pushX = ((x / window.innerWidth) - 0.5) * 18;
      const pushY = ((y / window.innerHeight) - 0.5) * 18;

      rootStyle.setProperty('--mx', `${x}px`);
      rootStyle.setProperty('--my', `${y}px`);
      rootStyle.setProperty('--push-x', `${pushX.toFixed(2)}px`);
      rootStyle.setProperty('--push-y', `${pushY.toFixed(2)}px`);
      rootStyle.setProperty('--ripple-opacity', '0.72');

      if (this.rippleIdleTimer) clearTimeout(this.rippleIdleTimer);
      this.rippleIdleTimer = setTimeout(() => {
        document.documentElement.style.setProperty('--ripple-opacity', '0.18');
      }, 420);
    });
  }

  async logout(): Promise<void> {
    await this.authService.signOut();
    this.router.navigate(['/login']);
  }

  getEmailShort(email: string): string {
    return email.split('@')[0];
  }
}
