import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 1. Validar si existe un Token de Acceso en el almacenamiento local
  if (authService.getAccessToken()) {
    return true; // Token válido: Permitimos el acceso al Layout Principal y rutas internas
  }

  // 2. Si no hay sesión iniciada, redirigimos de inmediato al formulario de login
  router.navigate(['/auth/login']);
  return false;
};