import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.css']
})
export class ChangePasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  passwordForm!: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.passwordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator // Validador a medida en caliente
    });
  }

  // 🛡️ CONTROL DE CALIDAD: Valida que ambas cajas de texto coincidan milimétricamente
  private passwordMatchValidator(g: FormGroup) {
    const pass = g.get('newPassword')?.value;
    const confirm = g.get('confirmPassword')?.value;
    return pass === confirm ? null : { mismatch: true };
  }

  onSubmit(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null;
    this.cdr.detectChanges();

    // 🔑 CAPTURA DE TOKENS SEGUROS: Jalamos el Bearer del login temporal
    const token = localStorage.getItem('token');
    if (!token) {
      this.isLoading = false;
      this.errorMessage = 'Su sesión temporal ha caducado. Por favor, vuelva al login.';
      this.cdr.detectChanges();
      return;
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const payload = { newPassword: this.passwordForm.value.newPassword };

    // Golpeamos tu nuevo endpoint transaccional de Node.js
    this.http.post<{ message: string }>(`${environment.apiUrl}/auth/change-password`, payload, { headers }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.successMessage = res?.message || '¡Contraseña actualizada con éxito!';
        
        // 🧼 PURGA DE SEGURIDAD: Limpiamos la RAM temporal y lo mandamos a loguearse limpio
        localStorage.removeItem('token');
        this.cdr.detectChanges();

        setTimeout(() => {
          this.router.navigate(['/auth/login']);
        }, 3000);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || 'Error al procesar la actualización en el cortafuegos.';
        this.cdr.detectChanges();
      }
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.passwordForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }
}