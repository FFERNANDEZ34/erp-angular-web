import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';

export interface ExchangeHistoryItem {
  id: number;
  exchangeDate: string;
  currencyCode: string;
  buyPrice: number;
  sellPrice: number;
  createdAt: string;
}

@Component({
  selector: 'app-currency-exchange',
  templateUrl: './currency-exchange.component.html',
  styleUrls: ['./currency-exchange.component.css']
})
export class CurrencyExchangeComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  private readonly API_EXCHANGE_URL = 'http://localhost:3000/api/exchanges';
  private readonly API_PARAMS_URL = 'http://localhost:3000/api/products/parameters';

  // 🧭 Vista activa de la pantalla: Matriz Diaria o Historial Cronológico
  activeView: 'diario' | 'historial' = 'diario';

  // Formulario e Históricos
  exchangeForm!: FormGroup;
  exchangeHistory: ExchangeHistoryItem[] = [];
  
  // Variables de Estado
  todayDateStr = '';
  isLoading = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  // Filtros del Historial
  filterStartDate = '';
  filterEndDate = '';

  ngOnInit(): void {
    this.calculateTodayDate();
    this.initForm();
    this.loadDailyMatrix(); // Carga las divisas activas de la base de datos
  }

  private calculateTodayDate(): void {
    const localDate = new Date();
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    this.todayDateStr = `${year}-${month}-${day}`; // Ajustado a zona horaria de Perú (2026-09-15)
  }

  private initForm(): void {
    this.exchangeForm = this.fb.group({
      exchangeDate: [this.todayDateStr, [Validators.required]],
      rates: this.fb.array([]) // Arreglo reactivo para inyectar múltiples divisas dinámicas
    });
  }

  get ratesArray(): FormArray {
    return this.exchangeForm.get('rates') as FormArray;
  }

  // 🛰️ PARTE A: CARGAR CASARÓN DIARIO DESDE PARÁMETROS AUXILIARES
  loadDailyMatrix(): void {
    this.isLoading = true;
    this.ratesArray.clear();

    // Consultamos las monedas configuradas en tu tabla paramétrica
    this.http.get<{ data: any[] }>(`${this.API_PARAMS_URL}?type=MONEDA`).subscribe({
      next: (res) => {
        const allCurrencies = res?.data || [];
        // Filtramos para ignorar la moneda nacional (Soles 'PEN') en la matriz de cotización
        const foreignCurrencies = allCurrencies.filter(c => c.code.toUpperCase() !== 'PEN');

        foreignCurrencies.forEach(curr => {
          this.ratesArray.push(this.fb.group({
            currencyParamId: [curr.id, [Validators.required]],
            currencyCode: [curr.code.toUpperCase(), [Validators.required]],
            buyPrice: [0, [Validators.required, Validators.min(0.01)]],
            sellPrice: [0, [Validators.required, Validators.min(0.01)]]
          }));
        });

        // Intentamos precargar si es que ya se registró algo hoy para no sobreescribir desde cero
        this.preloadExistingRates();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private preloadExistingRates(): void {
    this.http.get<{ data: any[] }>(`${this.API_EXCHANGE_URL}/history?startDate=${this.todayDateStr}&endDate=${this.todayDateStr}`).subscribe({
      next: (res) => {
        const existingToday = res?.data || [];
        if (existingToday.length > 0) {
          this.ratesArray.controls.forEach((control) => {
            const currentCode = control.get('currencyCode')?.value;
            const match = existingToday.find((r: any) => r.currencyCode.toUpperCase() === currentCode.toUpperCase());
            if (match) {
              control.patchValue({
                buyPrice: Number(match.buyPrice),
                sellPrice: Number(match.sellPrice)
              });
            }
          });
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // 💾 GUARDAR MATRIZ EN BLOQUE (POST CON UPSERT)
  onFormSubmit(): void {
    if (this.exchangeForm.invalid) {
      this.exchangeForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.successMessage = null;
    this.errorMessage = null;

    const payload = {
      exchangeDate: this.exchangeForm.value.exchangeDate,
      rates: this.exchangeForm.value.rates.map((r: any) => ({
        currencyParamId: Number(r.currencyParamId),
        currencyCode: r.currencyCode,
        buyPrice: Number(r.buyPrice),
        sellPrice: Number(r.sellPrice)
      }))
    };

    this.http.post(this.API_EXCHANGE_URL, payload).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = '¡Tasas de cambio guardadas y aplicadas con éxito en el holding!';
        this.loadDailyMatrix(); // Recarga y refresca
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || 'Error al guardar las divisas.';
        this.cdr.detectChanges();
      }
    });
  }

  // 🔎 PARTE B: CARGAR HISTORIAL CRONOLÓGICO
  loadHistory(): void {
    this.isLoading = true;
    let url = `${this.API_EXCHANGE_URL}/history`;
    
    if (this.filterStartDate && this.filterEndDate) {
      url += `?startDate=${this.filterStartDate}&endDate=${this.filterEndDate}`;
    }

    this.http.get<{ data: ExchangeHistoryItem[] }>(url).subscribe({
      next: (res) => {
        this.exchangeHistory = res?.data || [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.exchangeHistory = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  switchView(view: 'diario' | 'historial'): void {
    this.activeView = view;
    this.successMessage = null;
    this.errorMessage = null;
    if (view === 'historial') {
      this.loadHistory();
    } else {
      this.loadDailyMatrix();
    }
  }
}