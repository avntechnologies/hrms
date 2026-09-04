import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, concatMap, finalize, from, of, tap, toArray } from 'rxjs';
import { DocumentService } from '../../core/document.service';
import { DocumentOwnerType, StoredDocument } from '../../core/models';
import { ToastService } from '../../core/toast.service';

interface PendingDocument { file: File; url?: string }

@Component({
  selector: 'app-document',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  templateUrl: './document.component.html',
  styleUrl: './document.component.scss',
})
export class DocumentComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) ownerType!: DocumentOwnerType;
  @Input() ownerId = '';
  @Input() category = 'attachment';
  @Input() label = 'Documents';
  @Input() readonly = false;
  @Input() replaceMode = false;
  @Input() maxFiles = 10;
  @Input() maxSizeMb = 15;
  @Input() allowedExtensions?: string[];
  @Output() documentsChanged = new EventEmitter<StoredDocument[]>();

  private readonly service = inject(DocumentService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly documents = signal<StoredDocument[]>([]);
  readonly pending = signal<PendingDocument[]>([]);
  readonly busy = signal(false);
  readonly dragActive = signal(false);
  readonly preview = signal<{ name: string; type: string; url: SafeResourceUrl; rawUrl: string } | null>(null);

  static readonly extensionGroups = {
    image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tif', 'tiff'],
    pdf: ['pdf'],
    word: ['doc', 'docx', 'rtf'],
    sheet: ['xls', 'xlsx', 'csv'],
    presentation: ['ppt', 'pptx'],
    text: ['txt'],
    archive: ['zip', '7z', 'rar'],
    audio: ['mp3', 'wav', 'ogg'],
    video: ['mp4', 'webm', 'mov'],
    email: ['eml', 'msg'],
  } as const;
  static readonly allExtensions = Object.values(DocumentComponent.extensionGroups).flat();

  get accept(): string {
    return (this.allowedExtensions?.length ? this.allowedExtensions : DocumentComponent.allExtensions)
      .map((value) => `.${value.replace('.', '').toLowerCase()}`).join(',');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['ownerId'] || changes['ownerType'] || changes['category']) && this.ownerId) this.load();
  }

  ngOnDestroy(): void {
    this.pending().forEach((item) => item.url && URL.revokeObjectURL(item.url));
    this.closePreview();
  }

  selectFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  drop(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);
    this.addFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  @HostListener('paste', ['$event'])
  paste(event: ClipboardEvent): void {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (files.length) { event.preventDefault(); this.addFiles(files); }
  }

  removePending(index: number): void {
    const item = this.pending()[index];
    if (item?.url) URL.revokeObjectURL(item.url);
    this.pending.update((items) => items.filter((_, itemIndex) => itemIndex !== index));
  }

  saveDocuments(ownerId = this.ownerId): Observable<StoredDocument[]> {
    const files = this.pending().map((item) => item.file);
    if (!files.length) return of([]);
    if (!ownerId) throw new Error('A document owner is required before upload.');
    this.busy.set(true);
    return from(files).pipe(
      concatMap((file) => this.service.upload(this.ownerType, ownerId, this.category, file, this.replaceMode)),
      toArray(),
      tap((uploaded) => {
        this.pending().forEach((item) => item.url && URL.revokeObjectURL(item.url));
        this.pending.set([]);
        this.documents.update((items) => this.replaceMode ? uploaded : [...uploaded, ...items]);
        this.documentsChanged.emit(this.documents());
      }),
      finalize(() => this.busy.set(false)),
    );
  }

  open(document: StoredDocument): void {
    this.busy.set(true);
    this.service.content(document.id).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (blob) => {
        this.closePreview();
        const rawUrl = URL.createObjectURL(blob);
        this.preview.set({ name: document.fileName, type: document.contentType, rawUrl,
          url: this.sanitizer.bypassSecurityTrustResourceUrl(rawUrl) });
      },
      error: () => this.toast.error('Could not open the document.'),
    });
  }

  download(document: StoredDocument): void {
    this.service.content(document.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = Object.assign(globalThis.document.createElement('a'), { href: url, download: document.fileName });
        anchor.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.toast.error('Could not download the document.'),
    });
  }

  delete(document: StoredDocument): void {
    if (!confirm(`Delete ${document.fileName}?`)) return;
    this.busy.set(true);
    this.service.delete(document.id).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => { this.documents.update((items) => items.filter((item) => item.id !== document.id)); this.documentsChanged.emit(this.documents()); this.toast.success('Document deleted.'); },
      error: () => this.toast.error('Could not delete the document.'),
    });
  }

  closePreview(): void {
    const current = this.preview();
    if (current) URL.revokeObjectURL(current.rawUrl);
    this.preview.set(null);
  }

  isPreviewable(type: string): boolean {
    return type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/') || type === 'application/pdf' || type.startsWith('text/');
  }

  icon(extension: string): string {
    const value = extension.replace('.', '').toLowerCase();
    if (DocumentComponent.extensionGroups.image.includes(value as never)) return 'image';
    if (value === 'pdf') return 'picture_as_pdf';
    if (DocumentComponent.extensionGroups.video.includes(value as never)) return 'movie';
    if (DocumentComponent.extensionGroups.audio.includes(value as never)) return 'audio_file';
    if (DocumentComponent.extensionGroups.archive.includes(value as never)) return 'folder_zip';
    return 'description';
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  private load(): void {
    this.busy.set(true);
    this.service.list(this.ownerType, this.ownerId, this.category).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (items) => this.documents.set(items),
      error: () => this.toast.error(`Could not load ${this.label.toLowerCase()}.`),
    });
  }

  private addFiles(files: File[]): void {
    if (this.readonly || !files.length) return;
    const allowed = new Set((this.allowedExtensions?.length ? this.allowedExtensions : DocumentComponent.allExtensions)
      .map((value) => value.replace('.', '').toLowerCase()));
    const current = this.replaceMode ? [] : this.pending();
    const accepted: PendingDocument[] = [];
    for (const file of files) {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!allowed.has(extension)) { this.toast.error(`${file.name}: unsupported file type.`); continue; }
      if (file.size > this.maxSizeMb * 1024 * 1024) { this.toast.error(`${file.name}: maximum size is ${this.maxSizeMb} MB.`); continue; }
      if (current.length + accepted.length >= this.maxFiles) { this.toast.error(`A maximum of ${this.maxFiles} files is allowed.`); break; }
      accepted.push({ file, url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined });
      if (this.replaceMode) break;
    }
    this.pending.set(this.replaceMode ? accepted : [...current, ...accepted]);
    if (this.ownerId && accepted.length) this.saveDocuments().subscribe({ error: () => this.toast.error('Document upload failed.') });
  }
}
