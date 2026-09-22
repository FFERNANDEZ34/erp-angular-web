import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { KardexService } from '../../../../core/services/kardex.service';


@Component({
  selector: 'app-kardex-monitor',
  templateUrl: './kardex-monitor.component.html',
  styleUrls: ['./kardex-monitor.component.css']
})
export class KardexMonitorComponent implements OnInit {
  // Estados de las Grillas principales
  kardexList: any[] = [];
  filteredKardex: any[] = [];
  searchTerm = '';
  isLoadingSummary = false;

  // Estados del Visualizador de Movimientos Profundos
  selectedProduct: any = null;
  productMovements: any[] = [];
  isLoadingMovements = false;
  showMovementsModal = false;

  constructor(
    private readonly kardexService: KardexService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadKardexSummary();
  }

  // 1. Carga inicial del Almacén con semáforos lógicos
  loadKardexSummary(): void {
    this.isLoadingSummary = true;
    this.cdr.detectChanges();

    this.kardexService.getKardexSummary(this.searchTerm).subscribe({
      next: (res) => {
        this.kardexList = res?.data || [];
        this.filteredKardex = [...this.kardexList];
        this.isLoadingSummary = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando balance de Kardex:', err);
        this.isLoadingSummary = false;
        this.cdr.detectChanges();
      }
    });
  }

  // 2. Filtro de búsqueda predictivo local para velocidad instantánea
  onSearchChange(): void {
    const term = this.searchTerm.trim().toUpperCase();
    if (!term) {
      this.filteredKardex = [...this.kardexList];
    } else {
      this.filteredKardex = this.kardexList.filter(item => 
        item.productName.toUpperCase().includes(term) || 
        item.productCode.toUpperCase().includes(term)
      );
    }
    this.cdr.detectChanges();
  }

  // 3. Activador de Auditoría Histórica Profunda al dar un clic
  viewProductHistory(item: any): void {
    this.selectedProduct = item;
    this.productMovements = [];
    this.isLoadingMovements = true;
    this.showMovementsModal = true;
    this.cdr.detectChanges();

    this.kardexService.getProductMovements(item.productId).subscribe({
      next: (res) => {
        this.productMovements = res?.data || [];
        this.isLoadingMovements = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error extrayendo historial analítico:', err);
        this.isLoadingMovements = false;
        this.cdr.detectChanges();
      }
    });
  }
}