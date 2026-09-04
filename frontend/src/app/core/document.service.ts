import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { DocumentOwnerType, StoredDocument } from './models';
import { SKIP_GLOBAL_LOADING } from './loading.service';

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/documents`;
  private readonly quiet = new HttpContext().set(SKIP_GLOBAL_LOADING, true);

  list(ownerType: DocumentOwnerType, ownerId: string, category?: string): Observable<StoredDocument[]> {
    let params = new HttpParams().set('ownerType', ownerType).set('ownerId', ownerId);
    if (category) params = params.set('category', category);
    return this.http.get<StoredDocument[]>(this.baseUrl, { params, context: this.quiet });
  }

  upload(ownerType: DocumentOwnerType, ownerId: string, category: string, file: File, replace = false): Observable<StoredDocument> {
    const params = new HttpParams()
      .set('ownerType', ownerType).set('ownerId', ownerId).set('category', category).set('replace', replace);
    const data = new FormData();
    data.append('file', file, file.name);
    return this.http.post<StoredDocument>(this.baseUrl, data, { params });
  }

  content(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/content`, { responseType: 'blob', context: this.quiet });
  }

  delete(id: string): Observable<void> { return this.http.delete<void>(`${this.baseUrl}/${id}`); }
}
