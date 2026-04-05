import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  toasts$ = new Subject<ToastMessage[]>();
  private toasts: ToastMessage[] = [];

  show(message: string, type: 'success' | 'error' | 'info' = 'success'): void {
    const id = ++this.counter;
    const toast: ToastMessage = { id, message, type };
    this.toasts = [...this.toasts, toast];
    this.toasts$.next(this.toasts);
    setTimeout(() => this.remove(id), 3500);
  }

  remove(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.toasts$.next(this.toasts);
  }
}
