import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private isDark = false;

  init(): void {
    const saved = localStorage.getItem('fleet-theme');
    this.isDark = saved === 'dark';
    this.apply();
  }

  toggle(): void {
    this.isDark = !this.isDark;
    localStorage.setItem('fleet-theme', this.isDark ? 'dark' : 'light');
    this.apply();
  }

  get dark(): boolean {
    return this.isDark;
  }

  private apply(): void {
    if (this.isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
}
