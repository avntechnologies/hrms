import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { SKIP_GLOBAL_LOADING } from './loading.service';
import { NotificationFeed } from './models';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/notifications`;
  private readonly quiet = new HttpContext().set(SKIP_GLOBAL_LOADING, true);
  readonly feed = signal<NotificationFeed>({ items: [], unreadCount: 0 });

  load() {
    return this.http.get<NotificationFeed>(this.url, { context: this.quiet }).pipe(tap((feed) => this.feed.set(feed)));
  }

  markRead(id: string) {
    return this.http.put<void>(`${this.url}/${id}/read`, {}).pipe(tap(() => this.feed.update((feed) => ({
      unreadCount: Math.max(0, feed.unreadCount - (feed.items.find((item) => item.id === id)?.isRead ? 0 : 1)),
      items: feed.items.map((item) => item.id === id ? { ...item, isRead: true } : item),
    }))));
  }

  markAllRead() {
    return this.http.put<void>(`${this.url}/read-all`, {}).pipe(tap(() => this.feed.update((feed) => ({
      unreadCount: 0, items: feed.items.map((item) => ({ ...item, isRead: true })),
    }))));
  }
}
