import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToastService, ToastMessage } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-stack">
      <div *ngFor="let t of toasts" class="toast" [class]="t.type">
        <span class="toast-icon">{{ icons[t.type] }}</span>
        <span>{{ t.message }}</span>
      </div>
    </div>
  `
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: ToastMessage[] = [];
  icons: Record<string, string> = { success: '✓', error: '✕', info: 'i' };
  private sub!: Subscription;

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.sub = this.toastService.toasts$.subscribe(t => this.toasts = t);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
