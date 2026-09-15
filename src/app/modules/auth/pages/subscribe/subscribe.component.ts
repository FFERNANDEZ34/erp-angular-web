import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-subscribe',
  templateUrl: './subscribe.component.html',
  styleUrls: ['./subscribe.component.css']
})
export class SubscribeComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  subscribeForm!: FormGroup;
  errorMessage: string | null = null;
  isLoading = false;
  
  // 🎛️ Control de Pasos del Asistente
  currentStep = 1; 

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.subscribeForm = this.fb.group({
      // Campos Paso 1: Cuenta Maestra
      contactName: ['', [Validators.required, Validators.minLength(3)]],
      contactEmail: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      
      // Campos Paso 2: Primera Empresa
      companyName: ['', [Validators.required, Validators.minLength(2)]],
      companyRuc: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
      employeeCount: [1, [Validators.required, Validators.min(1)]]
    });
  }

  // 🔀 Métodos de navegación del Wizard
  nextStep(): void {
    // Validar únicamente los campos del Paso 1 antes de permitir avanzar
    const p1Fields = ['contactName', 'contactEmail', 'password'];
    let step1Valid = true;

    p1Fields.forEach(field => {
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
      this.errorMessage = 'Por favor, complete correctamente los datos del dueño antes de continuar.';
    }
  }

  prevStep(): void {
    this.currentStep = 1;
    this.errorMessage = null;
  }

  onSubmit(): void {
    if (this.subscribeForm.invalid) {
      this.subscribeForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    this.authService.subscribeCompany(this.subscribeForm.value).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/auth/login']);
      },
      error: (err:any) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Error al procesar la suscripción. Intente nuevamente.';
      }
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.subscribeForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }
}