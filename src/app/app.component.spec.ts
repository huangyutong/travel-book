import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the liquid ripple layer', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.liquid-ripple')).not.toBeNull();
  });

  it('updates pointer variables for the liquid ripple layer', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const style = document.documentElement.style;
    style.removeProperty('--mx');
    style.removeProperty('--my');
    spyOn(window, 'requestAnimationFrame').and.callFake((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    app.handlePointerMove({ clientX: 120, clientY: 240 } as PointerEvent);

    expect(style.getPropertyValue('--mx')).toBe('120px');
    expect(style.getPropertyValue('--my')).toBe('240px');
  });
});
