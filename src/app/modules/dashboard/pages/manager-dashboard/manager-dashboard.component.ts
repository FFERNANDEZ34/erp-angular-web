import { Component, OnInit, AfterViewInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { Chart, registerables } from 'chart.js';

// Registramos los componentes internos oficiales de Chart.js
Chart.register(...registerables);

@Component({
  selector: 'app-manager-dashboard',
  templateUrl: './manager-dashboard.component.html',
  styleUrls: ['./manager-dashboard.component.css']
})
export class ManagerDashboardComponent implements OnInit, AfterViewInit {
  // 🛰️ CAPTURADORES DEL DOM (CANVAS HTML)
  @ViewChild('trendCanvas') trendCanvas!: ElementRef;
  @ViewChild('paymentCanvas') paymentCanvas!: ElementRef;
  @ViewChild('productsCanvas') topProductsCanvas!: ElementRef;

  // Instancias activas de los gráficos para poder destruirlos/refrescarlos al conmutar combos
  trendChart: any;
  paymentChart: any;
  productsChart: any;

  // Catálogos de Filtros
  companiesList: any[] = [];
  branchesList: any[] = [];
  
  // Modelos de Filtros activos (Por defecto en "TODOS" / "ALL")
  selectedCompanyId: string = 'ALL';
  selectedBranchId: string = 'ALL';
  selectedYear: number = new Date().getFullYear();

  
  // 🎯 FILTRADO EN CASCADA: Esta lista alimentará el segundo combo en el HTML
  filteredBranches: any[] = [];

  

  // Métricas KPI superiores
  totalRevenuePeriod = 0;
  potentialRiskInventoryValue = 0;
  isLoading = false;

  constructor(private readonly http: HttpClient, private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadFilterCatalogs();
  }

  ngAfterViewInit(): void {
    this.loadExecutiveMetrics(); // Dispara la primera carga visual al pintar el DOM
  }

  // 1. Carga los catálogos del holding para alimentar los combos jerárquicos
  private loadFilterCatalogs(): void {
    // 🏢 A. Cargamos Compañías
    this.http.get<{ data: any }>(`${environment.apiUrl}/companies?limit=100`).subscribe(res => {
      const wrapper = res?.data || res;
      this.companiesList = wrapper?.data || wrapper || [];
      this.cdr.detectChanges();
    });

    // 📍 B. Cargamos TODOS los Locales Maestros del holding
    this.http.get<{ data: any }>(`${environment.apiUrl}/branches?limit=100`).subscribe(res => {
      const wrapper = res?.data || res;
      this.branchesList = wrapper?.data || wrapper || [];
      
      // Al nacer la pantalla, la lista filtrada muestra todos los locales por defecto
      this.filteredBranches = [...this.branchesList];
      this.cdr.detectChanges();
      
      // 🚀 DISPARO INICIAL: Ejecutamos la primera lectura contable una vez que los catálogos están listos
      this.loadExecutiveMetrics();
    });
  }

  onCompanyChange(): void {
    console.log(`📡 RADAR BI - Compañía seleccionada mutó a: [${this.selectedCompanyId}]`);
    
    // 1. Si elige "TODAS", volvemos a exponer todos los locales del holding y reseteamos el hijo
    if (this.selectedCompanyId === 'ALL') {
      this.filteredBranches = [...this.branchesList];
      this.selectedBranchId = 'ALL';
    } else {
      // 2. 🎯 EL FILTRADO EN CASCADA: Convertimos a número para comparar de forma estricta contra companyId de tu BD
      const companyIdNum = Number(this.selectedCompanyId);
      
      this.filteredBranches = this.branchesList.filter(b => Number(b.companyId) === companyIdNum);
      
      // Reseteamos el selector de local a "TODOS" para forzar un nuevo balance limpio de esa empresa
      this.selectedBranchId = 'ALL';
    }
    
    // 3. Despachamos la consulta automática hacia tu API de Node.js
    this.loadExecutiveMetrics();
  }

  // 2. Consume tu nueva API de analíticas cruzadas
  loadExecutiveMetrics(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    const query = `?companyId=${this.selectedCompanyId}&branchId=${this.selectedBranchId}&year=${this.selectedYear}`;
    
    this.http.get<{ status: string; data: any }>(`${environment.apiUrl}/dashboard/executive-metrics${query}`).subscribe({
      next: (res) => {
        const metrics = res?.data;
        
        // 🕵️‍♂️ EL RASTREADOR PERICIAL DE LA VIEJA ESCUELA
        console.log('================= 📊 RADAR FRONTEND BI: DATOS RECIBIDOS =================');
        console.log('1. Estructura completa del Payload:', metrics);
        console.log('2. Arreglo Tendencia Mensual:', metrics?.charts?.monthlySalesTrend);
        console.log('3. Arreglo Medios de Pago:', metrics?.charts?.paymentMethodsShare);
        console.log('4. Arreglo Productos Estrella:', metrics?.charts?.topSellingProducts);
        console.log('==========================================================================');

        if (metrics) {
          this.totalRevenuePeriod = metrics.financialSummary?.totalRevenuePeriod || 0;
          this.potentialRiskInventoryValue = metrics.financialSummary?.potentialRiskInventoryValue || 0;

          this.renderTrendChart(metrics.charts?.monthlySalesTrend || []);
          this.renderPaymentChart(metrics.charts?.paymentMethodsShare || []);
          this.renderProductsChart(metrics.charts?.topSellingProducts || []);
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error en el búnker BI:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // =========================================================================
  // 📈 PINTADO DE GRÁFICOS MEDIANTE CHART.JS PREMIUM
  // =========================================================================

  private renderTrendChart(data: any[]): void {
    if (this.trendChart) this.trendChart.destroy(); // 🛡️ Evita fugas de memoria y solapamientos
    
    const labels = data.map(d => d.label);
    const values = data.map(d => d.value);

    this.trendChart = new Chart(this.trendCanvas.nativeElement, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Ventas Conectadas (S/)',
          data: values,
          borderColor: '#0d6efd',
          backgroundColor: 'rgba(13, 110, 253, 0.05)',
          fill: true,
          tension: 0.3,
          borderWidth: 3
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  private renderPaymentChart(data: any[]): void {
    if (this.paymentChart) this.paymentChart.destroy();

    const labels = data.map(d => d.name);
    const values = data.map(d => d.value);

    this.paymentChart = new Chart(this.paymentCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ['#198754', '#ffc107', '#dc3545', '#0dcaf0', '#6c757d']
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  private renderProductsChart(data: any[]): void {
    if (this.productsChart) this.productsChart.destroy();

    const labels = data.map(d => d.productName);
    const values = data.map(d => d.revenueGenerated);

    this.productsChart = new Chart(this.topProductsCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Ingresos Totales por Ítem',
          data: values,
          backgroundColor: '#212529',
          borderRadius: 5
        }]
      },
      options: {
        indexAxis: 'y', // Voltea las barras de forma horizontal (Estándar Odoo)
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }
}