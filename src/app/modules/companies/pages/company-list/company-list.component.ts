
import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';

export interface CompanyItem {
  id: number;
  ruc: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  sunatUser?: string | null;
  sunatPassword?: string | null;
  certificatePassword?: string | null;
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
  
  private readonly API_URL = `${environment.apiUrl}/companies`;
  private readonly ATTACHMENT_API_URL = `${environment.apiUrl}/attachments`;
  public readonly STORAGE_BASE = environment.storageUrl;

  // 🧭 Control de Pestañas del Modal
  activeTab: 'datos' | 'credenciales' | 'adjuntos' = 'datos';

  // Colecciones y Rejilla
  companies: CompanyItem[] = [];
  companyFiles: any[] = []; // Carrete multimedia polimórfico de la empresa
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
  isUploadingFile = false;

  private searchSubject = new Subject<void>();
  private contextSubscription!: Subscription;

  ngOnInit(): void {
    this.initForm();

    // Sincronización SaaS Multi-tenant
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
      ruc: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
      name: ['', [Validators.required, Validators.minLength(3)]],
      address: [''],
      phone: [''],
      email: ['', [Validators.email]],
      // 🌟 Nuevos campos para la emisión electrónica SUNAT
      sunatUser: [''],
      sunatPassword: [''],
      certificatePassword: ['']
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

  // 🛰️ CONSULTAR ADJUNTOS DE LA COMPAÑÍA EN VIVO (LOGOS / CERTIFICADOS)
  loadCompanyAttachments(): void {
    if (!this.selectedCompanyId) return;
    
    const url = `${this.ATTACHMENT_API_URL}?module=COMPANIAS&recordId=${this.selectedCompanyId}`;
    this.http.get<{ data: any[] }>(url).subscribe({
      next: (res) => {
        this.companyFiles = res?.data || [];
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al recuperar archivos de la empresa:', err)
    });
  }

  // 📥 CARGA BINARIA DE LOGOTIPOS Y CERTIFICADOS .PFX CON CABECERAS EXPLICITAS
  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (!file || !this.selectedCompanyId) return;

    this.isUploadingFile = true;
    this.cdr.detectChanges();

    const formData = new FormData();
    formData.append('file', file);

    // Identificamos dinámicamente si es una imagen (Logo) para marcarlo como portada principal
    const isImage = file.type.startsWith('image/');

    const headers = {
      'x-related-module': 'COMPANIAS',
      'x-related-record-id': this.selectedCompanyId.toString(),
      'x-is-main-photo': isImage.toString()
    };

    this.http.post(`${this.ATTACHMENT_API_URL}/upload`, formData, { headers }).subscribe({
      next: () => {
        this.isUploadingFile = false;
        this.loadCompanyAttachments(); // Refresca carrete
        event.target.value = '';
      },
      error: (err) => {
        this.isUploadingFile = false;
        alert(err?.error?.message || 'Error en la subida del archivo fiscal.');
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

  openCreateModal(): void {
    this.isEditing = false;
    this.selectedCompanyId = null;
    this.formErrorMessage = null;
    this.activeTab = 'datos';
    this.companyFiles = [];
    this.companyForm.reset({ ruc: '', name: '', address: '', phone: '', email: '', sunatUser: '', sunatPassword: '', certificatePassword: '' });
    this.showModal = true;
    this.cdr.detectChanges();
  }

  onEdit(company: CompanyItem): void {
    this.isEditing = true;
    this.selectedCompanyId = company.id;
    this.formErrorMessage = null;
    this.activeTab = 'datos';
    this.companyFiles = [];
    this.companyForm.patchValue(company);
    this.loadCompanyAttachments(); // Dispara la auditoría de archivos
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

    const formValues = this.companyForm.value;
    const payload = {
      ruc: formValues.ruc.toString().trim(),
      name: formValues.name.trim(),
      address: formValues.address?.trim() || null,
      phone: formValues.phone?.trim() || null,
      email: formValues.email?.trim() || null,
      sunatUser: formValues.sunatUser?.trim() || null,
      sunatPassword: formValues.sunatPassword?.trim() || null,
      certificatePassword: formValues.certificatePassword?.trim() || null
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
    this.formErrorMessage = err?.error?.message || 'Error en la operación del holding.';
    this.cdr.detectChanges();
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.companyForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }
}