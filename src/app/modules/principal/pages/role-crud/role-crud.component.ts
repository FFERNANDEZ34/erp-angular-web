import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-role-crud',
  templateUrl: './role-crud.component.html',
  styleUrls: ['./role-crud.component.css']
})
export class RoleCrudComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);

  // Estados de la Grilla Paginada
  rolesList: any[] = [];
  totalItems = 0;
  totalPages = 0;
  currentPage = 1;
  itemsPerPage = 10;

  // Filtros reactivos
  searchQuery: string = '';
  private readonly searchSubject = new Subject<string>();

  // Controladores de Modales e Interfaces
  showModal = false;
  isEditMode = false;
  editingRoleId: number | null = null;
  roleForm!: FormGroup;

  isLoading = false;
  isActionLoading = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  ngOnInit(): void {
    this.loadRoles();

    // Regla de rendimiento Debounce para no saturar los sockets de Aiven
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(value => {
      this.searchQuery = value;
      this.currentPage = 1;
      this.loadRoles();
    });
  }

  onSearchChange(event: any): void {
    this.searchSubject.next(event.target.value);
  }

  // 📡 1. LEER ROLES DESDE EL NUEVO ENDPOINT PAGINADO
  loadRoles(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    const params = `?page=${this.currentPage}&limit=${this.itemsPerPage}&search=${encodeURIComponent(this.searchQuery)}`;

    this.http.get<{ status: string; data: any }>(`${environment.apiUrl}/security/roles-paginated${params}`).subscribe({
      next: (res) => {
        const payload = res?.data;
        if (payload) {
          this.rolesList = payload.rows || [];
          this.totalItems = payload.totalItems || 0;
          this.totalPages = payload.totalPages || 0;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || 'Error al conectar con el búnker de perfiles.';
        this.cdr.detectChanges();
      }
    });
  }

  // 📝 DISPARADOR: Inicializa formulario para CREAR
  openCreateModal(): void {
    this.isEditMode = false;
    this.editingRoleId = null;
    this.errorMessage = null;

    this.roleForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
      description: ['', [Validators.maxLength(255)]]
    });

    this.showModal = true;
    this.cdr.detectChanges();
  }

  // 📝 DISPARADOR: Inicializa formulario para EDITAR
  openEditModal(role: any): void {
    this.isEditMode = true;
    this.editingRoleId = role.id;
    this.errorMessage = null;

    this.roleForm = this.fb.group({
      name: [role.name, [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
      description: [role.description || '', [Validators.maxLength(255)]]
    });

    this.showModal = true;
    this.cdr.detectChanges();
  }

  // 💾 GRABADO TRANSACCIONAL EN LA NUBE (POST / PUT MULTI-FLOW)
  onSaveRole(): void {
    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      this.errorMessage = 'Por favor, complete correctamente el nombre del perfil.';
      this.cdr.detectChanges();
      return;
    }

    this.isActionLoading = true;
    this.errorMessage = null;
    this.successMessage = null;
    this.cdr.detectChanges();

    const payload = this.roleForm.value;

    if (!this.isEditMode) {
      // FLUJO A: CREAR NUEVO ROL (POST)
      this.http.post<{ message: string }>(`${environment.apiUrl}/security/roles`, payload).subscribe({
        next: (res) => {
          this.showModal = false;
          this.isActionLoading = false;
          this.successMessage = res?.message || 'Perfil fundado con éxito.';
          this.loadRoles();
        },
        error: (err) => {
          this.isActionLoading = false;
          this.errorMessage = err?.error?.message || 'Error al registrar el perfil.';
          this.cdr.detectChanges();
        }
      });
    } else {
      // FLUJO B: ACTUALIZAR ROL EXISTENTE (PUT)
      this.http.put<{ message: string }>(`${environment.apiUrl}/security/roles/${this.editingRoleId}`, payload).subscribe({
        next: (res) => {
          this.showModal = false;
          this.isActionLoading = false;
          this.successMessage = res?.message || 'Perfil actualizado correctamente.';
          this.loadRoles();
        },
        error: (err) => {
          this.isActionLoading = false;
          this.errorMessage = err?.error?.message || 'Error al actualizar el perfil.';
          this.cdr.detectChanges();
        }
      });
    }
  }

  // 🔒 BAJA LÓGICA DEFENSIVA DE ACCESOS (DELETE)
  onInactivateRole(roleId: number, name: string): void {
    if (!confirm(`¿Está seguro de que desea inhabilitar de forma permanente el perfil [${name}]?\nNingún colaborador podrá usar este rol de ahora en adelante.`)) {
      return;
    }

    this.isActionLoading = true;
    this.successMessage = null;
    this.errorMessage = null;
    this.cdr.detectChanges();

    this.http.delete<{ message: string }>(`${environment.apiUrl}/security/roles/${roleId}`).subscribe({
      next: (res) => {
        this.isActionLoading = false;
        this.successMessage = res?.message || 'Perfil inhabilitado con éxito.';
        this.loadRoles();
      },
      error: (err) => {
        this.isActionLoading = false;
        this.errorMessage = err?.error?.message || 'Error al aplicar la baja lógica al perfil.';
        this.cdr.detectChanges();
      }
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.loadRoles();
  }
  isFieldInvalid(fieldName: string): boolean {
    if (!this.roleForm) return false;
    const field = this.roleForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched || this.roleForm.touched));
  }
}