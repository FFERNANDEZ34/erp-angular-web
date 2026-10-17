import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject, Subscription, Observable } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { TicketPrinterService } from '../../../../core/services/ticket-printer.service';

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
  styleUrls: ['./invoice-list.component.css'],
})
export class InvoiceListComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private printerService = inject(TicketPrinterService); // 🟢 Inyección del motor térmico

  private readonly API_URL = `${environment.apiUrl}/invoices`;

  // Listado y Rejilla
  invoices: InvoiceHeaderItem[] = [];
  totalRecords = 0;
  currentPage = 1;
  pageSize = 10;
  isLoading = false;
  retryingIds: { [key: number]: boolean } = {};
  // 🔍 Filtros Horizontales Cruzados
  filterType = '';
  filterNumber = '';
  filterCustomer = '';
  
  public activeDropdownId: number | null = null;
  private searchSubject = new Subject<void>();
  private contextSubscription!: Subscription;

  ngOnInit(): void {
    // Sincronización Multi-tenant de Empresa Activa
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

  loadEntities(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    let url = `${this.API_URL}?page=${this.currentPage}&limit=${this.pageSize}`;

    if (this.filterType) url += `&documentType=${this.filterType}`;
    if (this.filterNumber.trim())
      url += `&fullDocumentNumber=${this.filterNumber.trim()}`;
    if (this.filterCustomer.trim())
      url += `&customerName=${encodeURIComponent(this.filterCustomer.trim())}`;

    this.http
      .get<{
        status: string;
        data: { data: InvoiceHeaderItem[]; total: number };
      }>(url)
      .subscribe({
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
    this.filterType = '';
    this.filterNumber = '';
    this.filterCustomer = '';
    this.currentPage = 1;
  }

  // 🚀 REDIRECCIÓN AL FORMULARIO EXTENSO COMPLEJO (PUNTO DE VENTA / POS)
  navigateToCreate(): void {
    this.router.navigate(['/principal/invoices/new']);
  }

  // 💥 ACCIÓN DE ANULACIÓN CONTABLE DIRECTA DESDE LA GRILLA
  onCancelInvoice(id: number, docNum: string): void {
    if (
      confirm(
        `¿Está completamente seguro de ANULAR el comprobante ${docNum}? Esta acción es irreversible.`,
      )
    ) {
      this.isLoading = true;
      this.http.delete(`${this.API_URL}/${id}`).subscribe({
        next: () => {
          this.loadEntities(); // Refresca grilla con estados mutados
        },
        error: (err) => {
          this.isLoading = false;
          alert(
            err?.error?.message || 'Error al procesar la anulación fiscal.',
          );
          this.cdr.detectChanges();
        },
      });
    }
  }

  retrySunat(
    invoiceId: number,
  ): Observable<{ success: boolean; sunatStatus: string; message: string }> {
    return this.http.post<{
      success: boolean;
      sunatStatus: string;
      message: string;
    }>(`${this.API_URL}/${invoiceId}/retry-sunat`, {});
  }
  // Y añade este método ejecutor debajo de tu función retrySunat:
  executeRetrySunat(invoiceId: number, index: number): void {
    if (this.retryingIds[invoiceId]) return;

    // 1. Encendemos el candado de control por ID
    this.retryingIds[invoiceId] = true;

    // 2. ⚡ MUTACIÓN PREVENTIVA: Forzamos temporalmente el estado en la fila para dar certeza al cajero
    if (this.invoices[index]) {
      this.invoices[index].sunatStatus = 'PROCESANDO';
      this.invoices[index].sunatDescription = 'Conectando con los servidores de la SUNAT en la RAM...';
    }
    this.cdr.detectChanges(); // Pintamos el estado "PROCESANDO" al instante

    this.retrySunat(invoiceId).subscribe({
      next: (response) => {
        this.retryingIds[invoiceId] = false;

        // 3. Reemplazamos por el veredicto final real devuelto por tu orquestador backend
        if (this.invoices[index]) {
          this.invoices[index].sunatStatus = response.sunatStatus;
          this.invoices[index].sunatDescription = response.message;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.retryingIds[invoiceId] = false;
        
        // Si se cae la red, regresamos a PENDIENTE para que pueda volver a intentar
        if (this.invoices[index]) {
          this.invoices[index].sunatStatus = 'PENDIENTE';
          this.invoices[index].sunatDescription = err?.error?.message || 'Error de conexión.';
        }
        alert(err?.error?.message || 'Error al procesar el reenvío fiscal.');
        this.cdr.detectChanges();
      }
    });
  }

  public getDownloadUrl(invoiceId: number): Observable<Blob> {
    // 🎯 REINGENIERÍA TOTAL: Cambiamos de retornar un string plano a realizar una petición HTTP estructurada
    // Al pasarle { responseType: 'blob' }, Angular entiende que recibirá un archivo (Stream de Bytes) y no un JSON
    return this.http.get(`${this.API_URL}/${invoiceId}/download-xml`, {
      responseType: 'blob'
    });
  }
  public onDownloadXml(invoiceId: number, fullDocumentNumber: string): void {
    console.log(`[ANGULAR] Solicitando XML firmado para el documento: ${fullDocumentNumber}`);

    this.getDownloadUrl(invoiceId).subscribe({
      next: (blob: Blob) => {
        // 1. Generamos un enlace lógico volátil acoplado al stream binario
        const windowUrl = window.URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        
        downloadLink.href = windowUrl;
        // 2. Le inyectamos el nombre oficial (Ej: "B002-00000001.xml")
        downloadLink.download = `${fullDocumentNumber}.xml`;
        
        // 3. Forzamos el click virtual del navegador en segundo plano
        document.body.appendChild(downloadLink);
        downloadLink.click();
        
        // 4. Limpieza de hardware inmediata: liberamos memoria RAM
        document.body.removeChild(downloadLink);
        window.URL.revokeObjectURL(windowUrl);
      },
      error: (err) => {
        console.error('🚨 Error al procesar la descarga binaria del XML:', err);
        alert('No se pudo recuperar el archivo XML firmado desde los servidores de resguardo.');
      }
    });
  }

  public onPrintInvoiceTicket(invoiceId: number): void {
    // 🎯 SIN PARPADEOS: Quitamos this.isLoading = true y detectores globales
    
    this.http.get<{ status: string; data: any }>(`${this.API_URL}/${invoiceId}`).subscribe({
      next: (res: any) => {
        const fullInvoiceData = res?.data || res;

        console.log(JSON.stringify(fullInvoiceData));
        // El iframe invisible se encarga de todo de forma silenciosa
        this.printerService.printThermalTicket(fullInvoiceData);
      },
      error: (err) => {
        alert(err?.error?.message || 'No se pudieron recuperar los detalles del comprobante.');
      }
    });
  }

  public toggleDropdown(invoiceId: number): void {
  this.activeDropdownId = this.activeDropdownId === invoiceId ? null : invoiceId;
}

public closeDropdown(): void {
  this.activeDropdownId = null;
}

}
