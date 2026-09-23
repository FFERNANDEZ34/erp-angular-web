import { Component, OnInit, AfterViewInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-inventory-dashboard',
  templateUrl: './inventory-dashboard.component.html',
  styleUrls: ['./inventory-dashboard.component.css']
})
export class InventoryDashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('trendKardexCanvas') trendKardexCanvas!: ElementRef;
  @ViewChild('categoryValuationCanvas') categoryValuationCanvas!: ElementRef;

  // Instancias de Chart.js en la RAM para el repintado líquido
  kardexChart: any;
  valuationChart: any;

  // Catálogos para los Combos Jerárquicos en cascada
  companiesList: any[] = [];
  branchesList: any[] = [];
  filteredBranches: any[] = [];

  // Modelos de Filtros Activos
  selectedCompanyId: string = 'ALL';
  selectedBranchId: string = 'ALL';
  isLoading = false;

  // KPIs Logísticos Superiores
  totalProductsInCatalog = 0;
  totalPhysicalUnits = 0;
  totalCapitalInvested = 0;
  productsInCriticalStock = 0;

  constructor(private readonly http: HttpClient, private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadFilterCatalogs();
  }

  ngAfterViewInit(): void {
    this.loadInventoryMetrics();
  }

  private loadFilterCatalogs(): void {
    this.http.get<{ data: any }>(`${environment.apiUrl}/companies?limit=100`).subscribe(res => {
      const wrapper = res?.data || res;
      this.companiesList = wrapper?.data || wrapper || [];
      this.cdr.detectChanges();
    });

    this.http.get<{ data: any }>(`${environment.apiUrl}/branches?limit=100`).subscribe(res => {
      const wrapper = res?.data || res;
      this.branchesList = wrapper?.data || wrapper || [];
      this.filteredBranches = [...this.branchesList];
      this.cdr.detectChanges();
    });
  }

  // Interceptor de cascada idéntico al financiero para resguardar la consistencia
  onCompanyChange(): void {
    if (this.selectedCompanyId === 'ALL') {
      this.filteredBranches = [...this.branchesList];
    } else {
      const companyIdNum = Number(this.selectedCompanyId);
      this.filteredBranches = this.branchesList.filter(b => Number(b.companyId) === companyIdNum);
    }
    this.selectedBranchId = 'ALL';
    this.loadInventoryMetrics();
  }

  loadInventoryMetrics(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    const query = `?companyId=${this.selectedCompanyId}&branchId=${this.selectedBranchId}`;

    this.http.get<{ status: string; data: any }>(`${environment.apiUrl}/dashboard/inventory-metrics${query}`).subscribe({
      next: (res) => {
        const metrics = res?.data;
        console.log('🕵️‍♂️ BI INVENTARIOS PAYLOAD:', metrics);

        if (metrics) {
          // Volcado de KPIs de Almacén
          this.totalProductsInCatalog = metrics.kpis?.totalProductsInCatalog || 0;
          this.totalPhysicalUnits = metrics.kpis?.totalPhysicalUnits || 0;
          this.totalCapitalInvested = metrics.kpis?.totalCapitalInvested || 0;
          this.productsInCriticalStock = metrics.kpis?.productsInCriticalStock || 0;

          // Renderizado Vectorial de Gráficos
          this.renderTrendChart(metrics.charts?.movementsTrend || []);
          this.renderValuationChart(metrics.charts?.categoryValuation || []);
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error inyectando métricas de almacén:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // 📉 GRAPH 1: Líneas comparativas cruzadas (Ingresos vs Salidas del Almacén)
  private renderTrendChart(data: any[]): void {
    if (this.kardexChart) this.kardexChart.destroy();

    const labels = data.map(d => d.month);
    const ingresos = data.map(d => d.ingresos);
    const salidas = data.map(d => d.salidas);

    this.kardexChart = new Chart(this.trendKardexCanvas.nativeElement, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Unidades Ingresadas (+)', data: ingresos, borderColor: '#198754', backgroundColor: 'transparent', tension: 0.2, borderWidth: 2.5 },
          { label: 'Unidades Despachadas (-)', data: salidas, borderColor: '#dc3545', backgroundColor: 'transparent', tension: 0.2, borderWidth: 2.5 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  // 📊 GRAPH 2: Valorización del Capital Inmovilizado por Categorías de MySQL
  private renderValuationChart(data: any[]): void {
    if (this.valuationChart) this.valuationChart.destroy();

    const labels = data.map(d => d.categoryName);
    const valuations = data.map(d => d.totalValuation);

    this.valuationChart = new Chart(this.categoryValuationCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Capital Inmovilizado (S/)',
          data: valuations,
          backgroundColor: '#ffc107',
          borderRadius: 4
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}