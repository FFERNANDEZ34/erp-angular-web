import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-subscribe',
  templateUrl: './subscribe.component.html',
  styleUrls: ['./subscribe.component.css'],
})
export class SubscribeComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  subscribeForm!: FormGroup;
  errorMessage: string | null = null;
  isLoading = false;
  showSuccessModal = false;

  // 🎛️ Control de Pasos del Asistente (Wizard)
  currentStep = 1;

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.subscribeForm = this.fb.group({
      // Campos Paso 1: Cuenta Maestra del Dueño del Holding
      contactName: ['', [Validators.required, Validators.minLength(3)]],
      contactEmail: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],

      // =========================================================================
      // 🎯 CANDADO REGEX SUNAT: El RUC debe arrancar estrictamente en 10, 15, 17 o 20
      // y contener exactamente 11 caracteres numéricos puros en total
      // =========================================================================
      companyName: ['', [Validators.required, Validators.minLength(2)]],
      companyRuc: ['', [Validators.required, Validators.pattern(/^(10|15|17|20)\d{9}$/)]],
      employeeCount: [1, [Validators.required, Validators.min(1)]],
    });
  }

  // 🔀 Métodos de navegación del Wizard
  nextStep(): void {
    // Validar únicamente los campos del Paso 1 antes de permitir avanzar al Paso 2
    const p1Fields = ['contactName', 'contactEmail', 'password'];
    let step1Valid = true;

    p1Fields.forEach((field) => {
      const control = this.subscribeForm.get(field);
      if (control) {
        control.markAsTouched();
        if (control.invalid) step1Valid = false;
      }
    });

    if (step1Valid) {
      this.currentStep = 2;
      this.errorMessage = null;
    } else {
      this.errorMessage =
        'Por favor, complete correctamente los datos del propietario antes de continuar.';
    }
    this.cdr.detectChanges();
  }

  prevStep(): void {
    this.currentStep = 1;
    this.errorMessage = null;
    this.cdr.detectChanges();
  }

  onSubmit(): void {
    if (this.subscribeForm.invalid) {
      this.subscribeForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.cdr.detectChanges(); // Sincroniza el spinner en la interfaz

    this.authService.subscribeCompany(this.subscribeForm.value).subscribe({
      next: () => {
        this.isLoading = false;
        this.showSuccessModal = true; // Despliega el modal flotante difuminado premium de alta UX
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isLoading = false;
        const apiError = err?.error;

        // 🎯 EL DESTRABE DE MATRICES ZOD: Sincronizado a tu captura de primer índice [0] con éxito
        if (
          apiError?.errors &&
          Array.isArray(apiError.errors) &&
          apiError.errors.length > 0
        ) {
          // Extraemos de forma dinámica el mensaje real del campo específico (ej: RUC)
          this.errorMessage = apiError.errors[0].message;
        } else {
          // Fallback para errores planos duplicados (409) o rebotes del caso de uso
          this.errorMessage =
            apiError?.message ||
            err?.error?.message ||
            'Error al procesar la suscripción. Intente nuevamente.';
        }

        this.cdr.detectChanges(); // 🔥 Forzamos el repintado inmediato del banner de alerta en tu monitor
      },
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.subscribeForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  closeModalAndGoToLogin(): void {
    this.showSuccessModal = false;
    this.cdr.detectChanges();
    this.router.navigate(['/auth/login']); // Redirección fluida al login de forma consciente y educada
  }
}