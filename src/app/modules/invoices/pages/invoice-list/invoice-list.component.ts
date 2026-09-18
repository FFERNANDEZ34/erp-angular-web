import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';

export interface InvoiceHeaderItem {
  id: number;
  documentType: string;
  series: string;
  correlative: string;
  fullDocumentNumber: string;
  issueDate: string;
  issueTime: string; 
  customerIdentityNumber: string;
  customerName: string;
  currencyCode: string;
  totalVenta: number;
  paymentStatus: string;
  sunatStatus: string;
  sunatDescription: string | null;
}

@Component({
  selector: 'app-invoice-list',
  templateUrl: './invoice-list.component.html',
  styleUrls: ['./invoice-list.component.css']
})
export class InvoiceListComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  private readonly API_URL = `${environment.apiUrl}/invoices`;

  // Listado y Rejilla
  invoices: InvoiceHeaderItem[] = [];
  totalRecords = 0;
  currentPage = 1;
  pageSize = 10;
  isLoading = false;

  // 🔍 Filtros Horizontales Cruzados
  filterType = '';
  filterNumber = '';
  filterCustomer = '';

  private searchSubject = new Subject<void>();
  private contextSubscription!: Subscription;

  ngOnInit(): void {
    // Sincronización Multi-tenant de Empresa Activa
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

  loadEntities(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    let url = `${this.API_URL}?page=${this.currentPage}&limit=${this.pageSize}`;
    
    if (this.filterType) url += `&documentType=${this.filterType}`;
    if (this.filterNumber.trim()) url += `&fullDocumentNumber=${this.filterNumber.trim()}`;
    if (this.filterCustomer.trim()) url += `&customerName=${encodeURIComponent(this.filterCustomer.trim())}`;

    this.http.get<{ status: string; data: { data: InvoiceHeaderItem[]; total: number } }>(url).subscribe({
      next: (res: any) => {
        const wrapper = res?.data || res;
        this.invoices = wrapper?.data || [];
        this.totalRecords = wrapper?.total || 0;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.invoices = [];
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
  resetFilters(): void { this.filterType = ''; this.filterNumber = ''; this.filterCustomer = ''; this.currentPage = 1; }

  // 🚀 REDIRECCIÓN AL FORMULARIO EXTENSO COMPLEJO (PUNTO DE VENTA / POS)
  navigateToCreate(): void {
    this.router.navigate(['/principal/invoices/new']);
  }

  // 💥 ACCIÓN DE ANULACIÓN CONTABLE DIRECTA DESDE LA GRILLA
  onCancelInvoice(id: number, docNum: string): void {
    if (confirm(`¿Está completamente seguro de ANULAR el comprobante ${docNum}? Esta acción es irreversible.`)) {
      this.isLoading = true;
      this.http.delete(`${this.API_URL}/${id}`).subscribe({
        next: () => {
          this.loadEntities(); // Refresca grilla con estados mutados
        },
        error: (err) => {
          this.isLoading = false;
          alert(err?.error?.message || 'Error al procesar la anulación fiscal.');
          this.cdr.detectChanges();
        }
      });
    }
  }
}