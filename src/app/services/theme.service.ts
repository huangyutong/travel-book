import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _isDark = false;

  constructor() {
    const saved = localStorage.getItem('travel_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.applyTheme(saved !== null ? saved === 'dark' : prefersDark);
  }

  get isDark(): boolean { return this._isDark; }

  toggle(): void {
    this.applyTheme(!this._isDark);
  }

  private applyTheme(dark: boolean): void {
    this._isDark = dark;
    document.body.classList.toggle('dark', dark);
    localStorage.setItem('travel_theme', dark ? 'dark' : 'light');
  }
}
