import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, Subscription, combineLatest } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';

export interface BranchItem {
  id: number;
  companyId: number;
  name: string;
  address: string | null;
  isPointOfSale: boolean;
  isWarehouse: boolean;
  defaultWarehouseId: number | null;
  Company?: { id: number; name: string; ruc: string };
  DefaultWarehouse?: { id: number; name: string };
}

@Component({
  selector: 'app-branch-list',
  templateUrl: './branch-list.component.html',
  styleUrls: ['./branch-list.component.css']
})
export class BranchListComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  
  private readonly API_URL = 'http://localhost:3000/api/branches';
  private readonly API_COMPANIES_URL = 'http://localhost:3000/api/companies';

  // Colecciones y Rejilla
  branches: BranchItem[] = [];
  companiesList: any[] = [];
  warehousesList: BranchItem[] = []; // Repositorio dinámico para el combo autorreferencial
  
  totalRecords = 0;
  currentPage = 1;
  pageSize = 10;
  isLoading = false;
  sortField = 'id';
  sortOrder: 'asc' | 'desc' = 'asc';

  // 🔍 Filtros
  filterName = '';
  filterCompanyId = '';

  // 🎛️ Formulario Modal (DataEntry)
  branchForm!: FormGroup;
  showModal = false;
  isEditing = false;
  selectedBranchId: number | null = null;
  formErrorMessage: string | null = null;

  private searchSubject = new Subject<void>();
  private contextSubscription!: Subscription;

  ngOnInit(): void {
    this.initForm();
    this.loadFormCatalogs(); // 🚀 Carga inicial en paralelo de empresas y almacenes

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
    this.branchForm = this.fb.group({
      companyId: ['', [Validators.required]],
      name: ['', [Validators.required, Validators.minLength(3)]],
      address: [''],
      isPointOfSale: [true],
      isWarehouse: [true],
      defaultWarehouseId: ['']
    });
  }

  // 🛰️ CARGA EN PARALELO DE COMPAÑÍAS Y ALMACENES EXISTENTES PARA LOS COMBOS
  loadFormCatalogs(): void {
    combineLatest([
      this.http.get<{ data: any }>(`${this.API_COMPANIES_URL}?limit=100`),
      this.http.get<{ data: any }>(`${this.API_URL}?limit=100`)
    ]).subscribe({
      next: ([companiesRes, branchesRes]) => {
        const compWrapper = companiesRes?.data || companiesRes;
        this.companiesList = compWrapper?.data || [];

        const branchWrapper = branchesRes?.data || branchesRes;
        const allBranches = branchWrapper?.data || [];
        // Filtramos para alimentar el combo autorreferencial únicamente con los registros que actúen como Almacén
        this.warehousesList = allBranches.filter((b: BranchItem) => b.isWarehouse);
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar catálogos de sucursales:', err)
    });
  }

  loadEntities(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    let url = `${this.API_URL}?page=${this.currentPage}&limit=${this.pageSize}&sortField=${this.sortField}&sortOrder=${this.sortOrder}`;
    
    if (this.filterName.trim()) url += `&name=${encodeURIComponent(this.filterName.trim())}`;
    if (this.filterCompanyId) url += `&companyId=${this.filterCompanyId}`;

    this.http.get<{ status: string; data: { data: BranchItem[]; total: number } }>(url).subscribe({
      next: (res: any) => {
        const wrapper = res?.data || res;
        this.branches = wrapper?.data || [];
        this.totalRecords = wrapper?.total || 0;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.branches = [];
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
  resetFilters(): void { this.filterName = ''; this.filterCompanyId = ''; this.currentPage = 1; }

  // =========================================================================
  // 💾 OPERACIONES DEL MODAL (POST / PUT / DELETE)
  // =========================================================================
  openCreateModal(): void {
    this.isEditing = false;
    this.selectedBranchId = null;
    this.formErrorMessage = null;
    this.branchForm.reset({ 
      companyId: this.companiesList[0]?.id || '', 
      name: '', address: '', isPointOfSale: true, isWarehouse: true, defaultWarehouseId: '' 
    });
    this.showModal = true;
    this.cdr.detectChanges();
  }

  onEdit(branch: BranchItem): void {
    this.isEditing = true;
    this.selectedBranchId = branch.id;
    this.formErrorMessage = null;
    this.branchForm.patchValue({
      companyId: branch.companyId,
      name: branch.name,
      address: branch.address,
      isPointOfSale: branch.isPointOfSale,
      isWarehouse: branch.isWarehouse,
      defaultWarehouseId: branch.defaultWarehouseId || ''
    });
    this.showModal = true;
    this.cdr.detectChanges();
  }

  closeModal(): void { this.showModal = false; this.cdr.detectChanges(); }

  onFormSubmit(): void {
    if (this.branchForm.invalid) {
      this.branchForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.formErrorMessage = null;

    const formValues = this.branchForm.value;
    const payload = {
      companyId: Number(formValues.companyId),
      name: formValues.name.trim(),
      address: formValues.address?.trim() || null,
      isPointOfSale: !!formValues.isPointOfSale,
      isWarehouse: !!formValues.isWarehouse,
      defaultWarehouseId: formValues.defaultWarehouseId ? Number(formValues.defaultWarehouseId) : null
    };

    if (this.isEditing && this.selectedBranchId) {
      this.http.put(`${this.API_URL}/${this.selectedBranchId}`, payload).subscribe({
        next: () => { this.isLoading = false; this.closeModal(); this.loadEntities(); this.loadFormCatalogs(); },
        error: (err) => this.handleError(err)
      });
    } else {
      this.http.post(this.API_URL, payload).subscribe({
        next: () => { this.isLoading = false; this.closeModal(); this.loadEntities(); this.loadFormCatalogs(); },
        error: (err) => this.handleError(err)
      });
    }
  }

  onDelete(id: number): void {
    if (confirm('¿Está seguro de dar de baja este establecimiento comercial?')) {
      this.http.delete(`${this.API_URL}/${id}`).subscribe(() => {
        this.loadEntities();
        this.loadFormCatalogs();
      });
    }
  }

  private handleError(err: any): void {
    this.isLoading = false;
    this.formErrorMessage = err?.error?.message || 'Error al procesar el establecimiento en MySQL.';
    this.cdr.detectChanges();
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.branchForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }
}