import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, Subscription, combineLatest } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';

export interface CompanyItem {
  id: number;
  ruc: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
}

@Component({
  selector: 'app-company-list',
  templateUrl: './company-list.component.html',
  styleUrls: ['./company-list.component.css']
})
export class CompanyListComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  
  private readonly API_URL = 'http://localhost:3000/api/companies';

  // Colecciones y Rejilla
  companies: CompanyItem[] = [];
  totalRecords = 0;
  currentPage = 1;
  pageSize = 10;
  isLoading = false;
  sortField = 'id';
  sortOrder: 'asc' | 'desc' = 'asc';

  // 🔍 Filtros
  filterRuc = '';
  filterName = '';

  // 🎛️ Formulario Modal (DataEntry)
  companyForm!: FormGroup;
  showModal = false;
  isEditing = false;
  selectedCompanyId: number | null = null;
  formErrorMessage: string | null = null;

  private searchSubject = new Subject<void>();
  private contextSubscription!: Subscription;

  ngOnInit(): void {
    this.initForm();

    // Sincronización Multi-tenant con el Holding SaaS
    this.contextSubscription = this.authService.activeCompanyId$.subscribe((companyId) => {
      if (companyId) {
        this.resetFilters();
        this.loadEntities();
      }
    });

    this.searchSubject.pipe(debounceTime(350)).subscribe(() => {
      this.currentPage = 1;
      this.loadEntities();
    });
  }

  ngOnDestroy(): void {
    if (this.contextSubscription) this.contextSubscription.unsubscribe();
  }

  private initForm(): void {
    this.companyForm = this.fb.group({
      ruc: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]], // 🛡️ Exige 11 dígitos numéricos puros
      name: ['', [Validators.required, Validators.minLength(3)]],
      address: [''],
      phone: [''],
      email: ['', [Validators.email]]
    });
  }

  loadEntities(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    let url = `${this.API_URL}?page=${this.currentPage}&limit=${this.pageSize}&sortField=${this.sortField}&sortOrder=${this.sortOrder}`;
    
    if (this.filterRuc.trim()) url += `&ruc=${this.filterRuc.trim()}`;
    if (this.filterName.trim()) url += `&name=${encodeURIComponent(this.filterName.trim())}`;

    this.http.get<{ status: string; data: { data: CompanyItem[]; total: number } }>(url).subscribe({
      next: (res: any) => {
        const wrapper = res?.data || res;
        this.companies = wrapper?.data || [];
        this.totalRecords = wrapper?.total || 0;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.companies = [];
        this.totalRecords = 0;
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onFilterChange(): void { this.searchSubject.next(); }
  onPageSizeChange(newSize: number): void { this.pageSize = Number(newSize); this.currentPage = 1; this.loadEntities(); }
  changePage(page: number): void { if (page >= 1 && page <= this.totalPages) { this.currentPage = page; this.loadEntities(); } }
  get totalPages(): number { return Math.ceil(this.totalRecords / this.pageSize) || 1; }
  changeOrder(field: string): void { this.sortField = field; this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc'; this.loadEntities(); }
  resetFilters(): void { this.filterRuc = ''; this.filterName = ''; this.currentPage = 1; }

  // =========================================================================
  // 💾 OPERACIONES DEL MODAL (POST / PUT / DELETE)
  // =========================================================================
  openCreateModal(): void {
    this.isEditing = false;
    this.selectedCompanyId = null;
    this.formErrorMessage = null;
    this.companyForm.reset({ ruc: '', name: '', address: '', phone: '', email: '' });
    this.showModal = true;
    this.cdr.detectChanges();
  }

  onEdit(company: CompanyItem): void {
    this.isEditing = true;
    this.selectedCompanyId = company.id;
    this.formErrorMessage = null;
    this.companyForm.patchValue(company);
    this.showModal = true;
    this.cdr.detectChanges();
  }

  closeModal(): void { this.showModal = false; this.cdr.detectChanges(); }

  onFormSubmit(): void {
    if (this.companyForm.invalid) {
      this.companyForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.formErrorMessage = null;

    const payload = {
      ruc: this.companyForm.value.ruc.toString().trim(),
      name: this.companyForm.value.name.trim(),
      address: this.companyForm.value.address?.trim() || null,
      phone: this.companyForm.value.phone?.trim() || null,
      email: this.companyForm.value.email?.trim() || null
    };

    if (this.isEditing && this.selectedCompanyId) {
      this.http.put(`${this.API_URL}/${this.selectedCompanyId}`, payload).subscribe({
        next: () => { this.isLoading = false; this.closeModal(); this.loadEntities(); },
        error: (err) => this.handleError(err)
      });
    } else {
      this.http.post(this.API_URL, payload).subscribe({
        next: () => { this.isLoading = false; this.closeModal(); this.loadEntities(); },
        error: (err) => this.handleError(err)
      });
    }
  }

  onDelete(id: number): void {
    if (confirm('¿Está seguro de dar de baja esta empresa del holding?')) {
      this.http.delete(`${this.API_URL}/${id}`).subscribe(() => this.loadEntities());
    }
  }

  private handleError(err: any): void {
    this.isLoading = false;
    this.formErrorMessage = err?.error?.message || 'Error al procesar la operación corporativa.';
    this.cdr.detectChanges();
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.companyForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }
}