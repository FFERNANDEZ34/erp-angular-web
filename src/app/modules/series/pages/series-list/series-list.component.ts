import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, Subscription, combineLatest } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';

export interface SeriesItem {
  id: number;
  companyId: number;
  branchId: number | null;
  documentType: string;
  series: string;
  currentNumber: number;
  description: string | null;
  createdAt: string;
}

@Component({
  selector: 'app-series-list',
  templateUrl: './series-list.component.html',
  styleUrls: ['./series-list.component.css'],
})
export class SeriesListComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  private readonly API_URL = `${environment.apiUrl}/series`;

  // Colecciones y Rejilla
  seriesList: SeriesItem[] = [];
  totalRecords = 0;
  currentPage = 1;
  pageSize = 10;
  isLoading = false;

  // 🔍 Filtros
  filterSeries = '';
  filterDocumentType = '';

  // 🎛️ Formulario Modal (DataEntry)
  seriesForm!: FormGroup;
  showModal = false;
  isEditing = false;
  selectedSeriesId: number | null = null;
  formErrorMessage: string | null = null;

  // Catálogo estático de tipos de documentos soportados por el ERP
  documentTypesList = [
    { code: 'FACTURA', name: 'Factura Electrónica (SUNAT)' },
    { code: 'BOLETA', name: 'Boleta de Venta (SUNAT)' },
    { code: 'NOTA_CREDITO', name: 'Nota de Crédito (SUNAT)' },
    { code: 'NOTA_DEBITO', name: 'Nota de Débito (SUNAT)' },
    { code: 'NOTA_PEDIDO', name: 'Nota de Pedido (Control Interno)' },
    { code: 'PRESUPUESTO', name: 'Presupuesto / Cotización' },
    { code: 'ORDEN_INGRESO', name: 'Orden de Ingreso (Kardex)' },
    { code: 'ORDEN_SALIDA', name: 'Orden de Salida (Kardex)' },
    { code: 'ORDEN_TRASLADO', name: 'Orden de Traslado (Kardex)' },
  ];

  private searchSubject = new Subject<void>();
  private contextSubscription!: Subscription;

  ngOnInit(): void {
    this.initForm();

    // Sincronización Multi-tenant con el selector de Empresas de tu barra superior
    this.contextSubscription = this.authService.activeCompanyId$.subscribe(
      (companyId) => {
        if (companyId) {
          this.resetFilters();
          this.loadEntities();
        }
      },
    );

    this.searchSubject.pipe(debounceTime(350)).subscribe(() => {
      this.currentPage = 1;
      this.loadEntities();
    });
  }

  ngOnDestroy(): void {
    if (this.contextSubscription) this.contextSubscription.unsubscribe();
  }

  private initForm(): void {
    this.seriesForm = this.fb.group({
      documentType: ['FACTURA', [Validators.required]],
      series: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(4),
          Validators.pattern(/^[A-Za-z0-9]+$/),
        ],
      ],
      currentNumber: [0, [Validators.required, Validators.min(0)]],
      description: [''],
    });
  }

  loadEntities(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    let url = `${this.API_URL}?page=${this.currentPage}&limit=${this.pageSize}`;

    if (this.filterSeries.trim())
      url += `&series=${this.filterSeries.trim().toUpperCase()}`;
    if (this.filterDocumentType)
      url += `&documentType=${this.filterDocumentType}`;

    this.http
      .get<{ status: string; data: { data: SeriesItem[]; total: number } }>(url)
      .subscribe({
        next: (res: any) => {
          const wrapper = res?.data || res;
          this.seriesList = wrapper?.data || [];
          this.totalRecords = wrapper?.total || 0;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.seriesList = [];
          this.totalRecords = 0;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

  onFilterChange(): void {
    this.searchSubject.next();
  }
  onPageSizeChange(newSize: number): void {
    this.pageSize = Number(newSize);
    this.currentPage = 1;
    this.loadEntities();
  }
  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadEntities();
    }
  }
  get totalPages(): number {
    return Math.ceil(this.totalRecords / this.pageSize) || 1;
  }
  resetFilters(): void {
    this.filterSeries = '';
    this.filterDocumentType = '';
    this.currentPage = 1;
  }

  // =========================================================================
  // 💾 OPERACIONES DEL MODAL (POST / PUT / DELETE)
  // =========================================================================
  openCreateModal(): void {
    this.isEditing = false;
    this.selectedSeriesId = null;
    this.formErrorMessage = null;
    this.seriesForm.reset({
      documentType: 'FACTURA',
      series: '',
      currentNumber: 0,
      description: '',
    });
    this.showModal = true;
    this.cdr.detectChanges();
  }

  onEdit(item: SeriesItem): void {
    this.isEditing = true;
    this.selectedSeriesId = item.id;
    this.formErrorMessage = null;
    this.seriesForm.patchValue({
      documentType: item.documentType,
      series: item.series,
      currentNumber: item.currentNumber,
      description: item.description,
    });
    this.showModal = true;
    this.cdr.detectChanges();
  }

  closeModal(): void {
    this.showModal = false;
    this.cdr.detectChanges();
  }

  onFormSubmit(): void {
    if (this.seriesForm.invalid) {
      this.seriesForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.formErrorMessage = null;

    const payload = {
      documentType: this.seriesForm.value.documentType.trim().toUpperCase(),
      series: this.seriesForm.value.series.trim().toUpperCase(),
      currentNumber: Number(this.seriesForm.value.currentNumber),
      description: this.seriesForm.value.description?.trim() || null,
    };

    if (this.isEditing && this.selectedSeriesId) {
      this.http
        .put(`${this.API_URL}/${this.selectedSeriesId}`, payload)
        .subscribe({
          next: () => {
            this.isLoading = false;
            this.closeModal();
            this.loadEntities();
          },
          error: (err) => this.handleError(err),
        });
    } else {
      this.http.post(this.API_URL, payload).subscribe({
        next: () => {
          this.isLoading = false;
          this.closeModal();
          this.loadEntities();
        },
        error: (err) => this.handleError(err),
      });
    }
  }

  onDelete(id: number): void {
    if (
      confirm(
        '¿Está seguro de dar de baja este talonario de series? No podrá reutilizarse la numeración.',
      )
    ) {
      this.http
        .delete(`${this.API_URL}/${id}`)
        .subscribe(() => this.loadEntities());
    }
  }

  private handleError(err: any): void {
    this.isLoading = false;
    this.formErrorMessage =
      err?.error?.message || 'Error al procesar el talonario en MySQL.';
    this.cdr.detectChanges();
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.seriesForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }
}
