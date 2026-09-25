import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core'; // 🚀 Importamos ChangeDetectorRef
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.ts.html',
  styleUrls: ['./login.component.ts.css'],
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef); // 🚀 Inyectamos el detector de cambios reactivo
  private http = inject(HttpClient);

  loginForm!: FormGroup;
  errorMessage: string | null = null;
  isLoading = false;

  showResendForm = false; // 🔀 Switch para mutar el Login por el panel de rescate
  resendEmailInput = ''; // Captura el correo de reenvío

  successMessage: string | null = null;

  toggleResendPanel(state: boolean): void {
    this.showResendForm = state;
    this.errorMessage = null;
    this.cdr.detectChanges();
  }

  onResendPublic(): void {
    if (!this.resendEmailInput || !this.resendEmailInput.includes('@')) {
      this.errorMessage =
        'Por favor, ingrese un correo electrónico corporativo válido.';
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null; // Reseteamos estados previos
    this.cdr.detectChanges();

    this.http
      .post<{ message: string }>(
        `${environment.apiUrl}/auth/resend-verification`,
        {
          email: this.resendEmailInput.trim().toLowerCase(),
        },
      )
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          //alert(res?.message || 'Enlace enviado. Revise su bandeja de entrada.');
          this.successMessage =
            res?.message || 'Enlace de activación despachado con éxito.';

          //this.toggleResendPanel(false); // Regresa al login
          this.resendEmailInput = '';
          this.cdr.detectChanges();
          setTimeout(() => {
            this.toggleResendPanel(false);
            this.successMessage = null;
            this.cdr.detectChanges();
          }, 4500);
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage =
            err?.error?.message ||
            'No se pudo procesar el reenvío de activación.';
          this.cdr.detectChanges();
        },
      });
  }

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false],
    });
  }

  onSubmit(): void {
    console.log(
      '================ 🔐 INTERCEPTOR MAESTRO DE LOGIN ================',
    );
    console.log('1. Disparo de onSubmit() detectado con éxito en la UI.');
    console.log(
      '2. Estado de validez del formulario:',
      this.loginForm.valid ? 'VALIDO ✅' : 'INVALIDO ❌',
    );
    console.log('3. Valores capturados en inputs:', {
      email: this.loginForm.get('email')?.value,
      password: '***',
    });

    if (this.loginForm.invalid) {
      console.warn(
        '⚠️ Formulario inválido. Deteniendo ejecución y marcando campos.',
      );
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.cdr.detectChanges();
    console.log('4. Spinner de carga encendido.errorMessage reseteado en RAM.');

    const { email, password } = this.loginForm.value;

    console.log('5. Despachando petición HTTP hacia AuthService...');
    this.authService.login({ email, password }).subscribe({
      next: (res: any) => {
        this.isLoading = false;

        // 🎯 EL CONTROLADOR DE UX EN TU MONITOR:
        // Evaluamos el flag que inyectamos en el backend
        if (
          res?.user?.mustChangePassword === true ||
          res?.data?.user?.mustChangePassword === true
        ) {
          console.log(
            '🔒 Cuenta con clave temporal detectada. Redirigiendo a cambio obligatorio.',
          );

          // Guardas el token temporalmente y lo desvías a la pantalla de cambio
          localStorage.setItem('token', res.accessToken || res.token);
          this.router.navigate(['/auth/change-password']);
        } else {
          // Si ya cambió su clave anteriormente, entra directo al ERP de forma normal
          console.log('✅ Cuenta verificada y libre. Luz verde hacia el ERP.');
          this.router.navigate(['/principal']);
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(
          '💥 ¡REBOTE DETECTADO EN EL CANAL DE AUTENTICACIÓN! Objeto HttpErrorResponse completo:',
          err,
        );
        console.log(
          '7. Código de estado HTTP retornado por la red:',
          err?.status,
        );

        this.isLoading = false;

        // Extraemos el cuerpo del error enviado por Express (HttpErrorResponse)
        const apiError = err?.error;
        console.log(
          '8. Payload limpio extraído del error (apiError):',
          apiError,
        );

        // 🛡️ FILTRO DE CONTROL DE SEGURIDAD MULTI-TENANT (Aiven Firewall)
        if (apiError?.code === 'EMAIL_NOT_VERIFIED' || err?.status === 403) {
          console.log(
            '🔒 Disparador activado: Cuenta registrada pero no verificada.',
          );
          this.errorMessage =
            apiError?.message ||
            'Su cuenta requiere confirmación por correo electrónico obligatoria.';
        } else {
          console.log(
            '🔑 Disparador activado: Credenciales incorrectas o error común.',
          );
          this.errorMessage =
            apiError?.message ||
            err?.error?.message ||
            'Credenciales incorrectas o servidor no disponible.';
        }

        console.log(
          '9. Valor final asignado a this.errorMessage:',
          this.errorMessage,
        );

        this.cdr.detectChanges(); // Forzamos el repintado
        console.log(
          '10. DetectChanges ejecutado. El DOM debería pintar el banner ahora mismo.',
        );
        console.log(
          '==================================================================',
        );
      },
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }
}
