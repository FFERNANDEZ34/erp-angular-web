import { Injectable, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private authService = inject(AuthService);

  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // 🛡️ CERROJO ANTIBUCLE: Si la petición ya viene con una cabecera de reintento, no la volvemos a procesar si falla
    if (req.headers.has('x-is-retry-request')) {
      return next.handle(req);
    }

    const token = this.authService.getAccessToken();
    const companyId = this.authService.activeCompanyId$.getValue() || this.authService.activeCompanyId$.value;
    const branchId = this.authService.activeBranchId$.getValue() || this.authService.activeBranchId$.value;

    let clonedRequest = req;

    if (token) {
      clonedRequest = this.injectHeaders(req, token, companyId, branchId);
    }

    return next.handle(clonedRequest).pipe(
      catchError((error: HttpErrorResponse) => {
        // Interceptamos la expiración del accessToken de forma quirúrgica
        if (error instanceof HttpErrorResponse && error.status === 401) {
          console.warn('⚠️ Token expirado detectado en el interceptor. Iniciando Silent Refresh...');
          return this.handle401Error(req, next, companyId, branchId);
        }
        return throwError(() => error);
      })
    );
  }

  private injectHeaders(request: HttpRequest<any>, token: string, companyId: any, branchId: any, isRetry = false): HttpRequest<any> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'x-company-id': companyId ? companyId.toString() : '',
      'x-branch-id': branchId ? branchId.toString() : ''
    };

    // Si es un reintento, le estampamos la marca de agua para desactivar bucles infinitos
    if (isRetry) {
      headers['x-is-retry-request'] = 'true';
    }

    return request.clone({ setHeaders: headers });
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler, companyId: any, branchId: any): Observable<HttpEvent<any>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        this.isRefreshing = false;
        this.authService.clearSession();
        window.location.href = '/auth/login';
        return throwError(() => new Error('Sesión terminada por falta de Refresh Token.'));
      }

      // Despachamos la solicitud de renovación al backend de Express
      return this.authService.refreshSessionToken(refreshToken).pipe(
        switchMap((res: any) => {
          this.isRefreshing = false;
          
          const nuevoAccessToken = res?.data?.accessToken || res?.accessToken;
          const nuevoRefreshToken = res?.data?.refreshToken || res?.refreshToken;

          if (nuevoAccessToken) {
            localStorage.setItem('accessToken', nuevoAccessToken);
            if (nuevoRefreshToken) localStorage.setItem('refreshToken', nuevoRefreshToken);

            this.refreshTokenSubject.next(nuevoAccessToken);
            
            console.log('🔄 Silent Refresh exitoso. Clonando petición original con marcas de agua...');
            // 🚀 REINTENTO BLINDADO: Enviamos true en la bandera 'isRetry' para estampar la marca de agua
            return next.handle(this.injectHeaders(request, nuevoAccessToken, companyId, branchId, true));
          }

          this.authService.clearSession();
          window.location.href = '/auth/login';
          return throwError(() => new Error('Error al decodificar la estructura del refresco.'));
        }),
        catchError((err) => {
          this.isRefreshing = false;
          this.authService.clearSession();
          window.location.href = '/auth/login';
          return throwError(() => err);
        })
      );
    } else {
      // Si el semáforo está encendido (ya hay un refresco en camino), encolamos las peticiones paralelas
      return this.refreshTokenSubject.pipe(
        filter(token => token !== null),
        take(1),
        switchMap((token) => next.handle(this.injectHeaders(request, token, companyId, branchId, true)))
      );
    }
  }
}