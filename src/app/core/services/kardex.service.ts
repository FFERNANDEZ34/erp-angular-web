import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class KardexService {
  private readonly API_URL = `${environment.apiUrl}/kardex`;

  constructor(private readonly http: HttpClient) {}

  // 📊 Trae la lista consolidada de saldos con banderas rojas de stock mínimo
  getKardexSummary(search?: string): Observable<{ status: string; data: any[] }> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.http.get<{ status: string; data: any[] }>(`${this.API_URL}/summary${query}`);
  }

  // 🕵️‍♂️ Trae el historial inmutable de movimientos de un artículo específico
  getProductMovements(productId: number, branchId?: number): Observable<{ status: string; data: any[] }> {
    let query = '';
    if (branchId) query = `?branchId=${branchId}`;
    return this.http.get<{ status: string; data: any[] }>(`${this.API_URL}/movements/${productId}${query}`);
  }
}