import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'fmtDate', standalone: true })
export class FmtDatePipe implements PipeTransform {
  transform(value: string | Date | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}

@Pipe({ name: 'fmtDatetime', standalone: true })
export class FmtDatetimePipe implements PipeTransform {
  transform(value: string | Date | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}

@Pipe({ name: 'fmtKm', standalone: true })
export class FmtKmPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value == null) return '—';
    return Number(value).toLocaleString() + ' km';
  }
}

@Pipe({ name: 'fmtThb', standalone: true })
export class FmtThbPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value == null) return '—';
    return '฿' + Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 });
  }
}

@Pipe({ name: 'fmtRelative', standalone: true })
export class FmtRelativePipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const s = (Date.now() - new Date(value).getTime()) / 1000;
    if (s < 60) return 'Just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }
}
