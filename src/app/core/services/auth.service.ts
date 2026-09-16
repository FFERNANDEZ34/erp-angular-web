import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/auth`;

  // Estados reactivos globales
  public activeCompanyId$ = new BehaviorSubject<number | null>(null);
  public activeBranchId$ = new BehaviorSubject<number | null>(null);
  public activeProfile$ = new BehaviorSubject<string | null>(null);

  login(credentials: any): Observable<any> {
    return this.http.post(`${this.API_URL}/login`, credentials).pipe(
      tap((res: any) => {
        this.saveSession(res.accessToken, res.refreshToken, res.user);
      }),
    );
  }

  subscribeCompany(data: any): Observable<any> {
    return this.http.post(`${this.API_URL}/subscribe`, data);
  }

  // 🔄 NUEVO MÉTODO CONMUTADOR: Llama al backend para actualizar el contexto activo y emitir un nuevo JWT
  switchContext(
    companyId: number,
    branchId: number,
    roleName: string,
  ): Observable<any> {
    return this.http
      .post(`${this.API_URL}/switch-context`, { companyId, branchId, roleName })
      .pipe(
        tap((res: any) => {
          // 🛡️ REGLA MAESTRA: Extraemos el token del nodo exacto de tu respuesta (.data.accessToken)
          const token = res.data?.accessToken || res.accessToken;
          if (token) {
            localStorage.setItem('accessToken', token); // Actualiza físicamente el disco
          }

          // Notificamos reactivamente a todo el sistema del nuevo entorno operativo
          this.activeCompanyId$.next(companyId);
          this.activeBranchId$.next(branchId);
          this.activeProfile$.next(roleName);
        }),
      );
  }

  private saveSession(
    accessToken: string,
    refreshToken: string,
    user: any,
  ): void {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
  }

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  // Método auxiliar para parsear los datos del JWT y extraer la estructura de permisos en vivo
  getUserDataFromToken(): any {
    const token = this.getAccessToken();
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

      // Decodificación compatible con UTF-8 para evitar corrupción de objetos JSON
      const jsonPayload = decodeURIComponent(
        window
          .atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );

      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error(
        'Error crítico decodificando el token en el Frontend:',
        error,
      );
      return null;
    }
  }

  refreshSessionToken(refreshToken: string): Observable<any> {
    // Ajusta la URL según cómo se llame el endpoint de refresco en tu API de Express (Ej: /api/auth/refresh)
    return this.http.post<any>(`${this.API_URL}/refresh`, {
      refreshToken,
    });
  }

  clearSession(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    this.activeCompanyId$.next(null);
    this.activeBranchId$.next(null);
    this.activeProfile$.next(null);
  }

  logout(): Observable<any> {
    return this.http
      .post(`${this.API_URL}/logout`, {})
      .pipe(tap(() => this.clearSession()));
  }

  setContext(companyId: number, branchId: number): void {
    this.activeCompanyId$.next(companyId);
    this.activeBranchId$.next(branchId);
  }
}
