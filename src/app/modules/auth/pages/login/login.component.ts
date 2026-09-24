import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core'; // 🚀 Importamos ChangeDetectorRef
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.ts.html',
  styleUrls: ['./login.component.ts.css']
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef); // 🚀 Inyectamos el detector de cambios reactivo

  loginForm!: FormGroup;
  errorMessage: string | null = null;
  isLoading = false;

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });
  }

  onSubmit(): void {
    console.log('================ 🔐 INTERCEPTOR MAESTRO DE LOGIN ================');
    console.log('1. Disparo de onSubmit() detectado con éxito en la UI.');
    console.log('2. Estado de validez del formulario:', this.loginForm.valid ? 'VALIDO ✅' : 'INVALIDO ❌');
    console.log('3. Valores capturados en inputs:', { email: this.loginForm.get('email')?.value, password: '***' });

    if (this.loginForm.invalid) {
      console.warn('⚠️ Formulario inválido. Deteniendo ejecución y marcando campos.');
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
      next: (res) => {
        console.log('🎉 ¡LOGIN EXITOSO EN BACKEND! Payload recibido:', res);
        this.isLoading = false;
        console.log('6. Redirigiendo fluidamente hacia la ruta master [/principal]...');
        
        this.router.navigate(['/principal']);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('💥 ¡REBOTE DETECTADO EN EL CANAL DE AUTENTICACIÓN! Objeto HttpErrorResponse completo:', err);
        console.log('7. Código de estado HTTP retornado por la red:', err?.status);
        
        this.isLoading = false;
        
        // Extraemos el cuerpo del error enviado por Express (HttpErrorResponse)
        const apiError = err?.error;
        console.log('8. Payload limpio extraído del error (apiError):', apiError);

        // 🛡️ FILTRO DE CONTROL DE SEGURIDAD MULTI-TENANT (Aiven Firewall)
        if (apiError?.code === 'EMAIL_NOT_VERIFIED' || err?.status === 403) {
          console.log('🔒 Disparador activado: Cuenta registrada pero no verificada.');
          this.errorMessage = apiError?.message || 'Su cuenta requiere confirmación por correo electrónico obligatoria.';
        } else {
          console.log('🔑 Disparador activado: Credenciales incorrectas o error común.');
          this.errorMessage = apiError?.message || err?.error?.message || 'Credenciales incorrectas o servidor no disponible.';
        }

        console.log('9. Valor final asignado a this.errorMessage:', this.errorMessage);
        
        this.cdr.detectChanges(); // Forzamos el repintado
        console.log('10. DetectChanges ejecutado. El DOM debería pintar el banner ahora mismo.');
        console.log('==================================================================');
      }
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }
}