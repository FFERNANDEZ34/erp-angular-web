import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-confirm-email',
  templateUrl: './confirm-email.component.html',
  styleUrls: ['./confirm-email.component.css']
})
export class ConfirmEmailComponent implements OnInit {
  token: string | null = null;
  
  // Máscara de estados para la UI Líquida
  currentState: 'LOADING' | 'SUCCESS' | 'ERROR' = 'LOADING';
  apiResponseMessage = '';
  countdownSeconds = 5; // Temporizador dinámico para redirección automática

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // 🕵️‍♂️ RADAR DE URL: Captura de forma reactiva el ?token=xyz... enviado desde el correo
    this.token = this.route.snapshot.queryParamMap.get('token');

    if (!this.token) {
      this.currentState = 'ERROR';
      this.apiResponseMessage = 'El enlace de verificación está incompleto, corrupto o carece de firma criptográfica válida.';
      this.cdr.detectChanges();
      return;
    }

    // Si el token viaja en la red, disparamos el desbloqueo atómico hacia tu backend
    this.verifyTokenInBackend();
  }

  private verifyTokenInBackend(): void {
    this.currentState = 'LOADING';
    this.cdr.detectChanges();

    // Consumimos tu nuevo endpoint público GET /api/auth/confirm-email?token=...
    this.http.get<{ status: string; message: string }>(
      `${environment.apiUrl}/auth/confirm-email?token=${this.token}`
    ).subscribe({
      next: (res) => {
        this.currentState = 'SUCCESS';
        this.apiResponseMessage = res?.message || '¡Espectacular! Su correo ha sido verificado con éxito.';
        this.cdr.detectChanges();

        // ⏱️ TEMPORIZADOR EJECUTIVO: Inicia cuenta regresiva para mandarlo al login automáticamente
        this.startRedirectionCountdown();
      },
      error: (err) => {
        this.currentState = 'ERROR';
        // Capturamos el rebote controlado de Aiven (ej: Token expirado)
        this.apiResponseMessage = err?.error?.message || 'El enlace de confirmación ha caducado o ya fue utilizado.';
        this.cdr.detectChanges();
      }
    });
  }

  private startRedirectionCountdown(): void {
    const interval = setInterval(() => {
      this.countdownSeconds--;
      this.cdr.detectChanges();

      if (this.countdownSeconds <= 0) {
        clearInterval(interval);
        this.router.navigate(['/auth/login']); // 🚀 Redirección fluida al login
      }
    }, 1000);
  }
}