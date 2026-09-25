import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';

@Component({
  selector: 'app-user-crud',
  templateUrl: './user-crud.component.html',
  styleUrls: ['./user-crud.component.css'],
})
export class UserCrudComponent implements OnInit {
  // Lista de Colaboradores e Información de Paginación
  usersList: any[] = [];
  totalItems = 0;
  totalPages = 0;
  currentPage = 1;
  itemsPerPage = 10;

  // Filtros reactivos
  searchQuery: string = '';
  private searchSubject = new Subject<string>();

  // Estados de la interfaz
  isLoading = false;
  isActionLoading = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  // Controladores de Modales y Formularios
  showModal = false;
  isEditMode = false;
  editingUserId: number | null = null;
  userForm!: FormGroup;

  // Catálogos para el Bucle de Locales Asignados
  companiesCatalog: any[] = [];
  branchesCatalog: any[] = [];
  rolesCatalog: any[] = [];

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
    private readonly fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.loadUsers();

    // 🎯 EL DESTRABE DE COMBOS: Descomentamos e invocamos la carga inmediata de catálogos
    this.loadCatalogs();

    // 🎯 REGLA DE RENDIMIENTO: Evita golpear la base de datos por cada letra digitada
    this.searchSubject
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe((value) => {
        this.searchQuery = value;
        this.currentPage = 1; // Reseteamos a la primera página tras filtrar
        this.loadUsers();
      });
  }

  // Captura el teclado en el input de búsqueda
  onSearchChange(event: any): void {
    this.searchSubject.next(event.target.value);
  }

  // 📡 1. LEER PERSONAL DESDE AIVEN CON FORMATO PAGINADO
  loadUsers(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    const params = `?page=${this.currentPage}&limit=${this.itemsPerPage}&search=${encodeURIComponent(this.searchQuery)}`;

    this.http
      .get<{
        status: string;
        data: any;
      }>(`${environment.apiUrl}/security/subusers${params}`)
      .subscribe({
        next: (res) => {
          const payload = res?.data;
          if (payload) {
            this.usersList = payload.rows || [];
            this.totalItems = payload.totalItems || 0;
            this.totalPages = payload.totalPages || 0;
          }
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage =
            err?.error?.message ||
            'Error al conectar con el catálogo de personal de Aiven.';
          this.cdr.detectChanges();
        },
      });
  }

  // 🔄 2. CONTROLADORES DE CAMBIO DE PÁGINA INDESTRUCTIBLES
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.loadUsers();
  }

  // 🔒 3. ACCIÓN DE BAJA LÓGICA DEFENSIVA (DESACTIVACIÓN SAAAS)
  onInactivateUser(userId: number, email: string): void {
    if (
      !confirm(
        `¿Está absolutamente seguro de que desea inhabilitar y revocar todos los accesos multi-tenant del colaborador [${email}]?\nEsta acción no borrará su historial de facturación.`,
      )
    ) {
      return;
    }

    this.isActionLoading = true;
    this.successMessage = null;
    this.errorMessage = null;
    this.cdr.detectChanges();

    this.http
      .delete<{
        message: string;
      }>(`${environment.apiUrl}/security/subusers/${userId}`)
      .subscribe({
        next: (res) => {
          this.isActionLoading = false;
          this.successMessage =
            res?.message ||
            'Colaborador desactivado correctamente de la suite SaaS.';
          this.loadUsers(); // Recargamos la grilla para refrescar los datos
        },
        error: (err) => {
          this.isActionLoading = false;
          this.errorMessage =
            err?.error?.message ||
            'Error en el búnker de ciberseguridad al aplicar la baja lógica.';
          this.cdr.detectChanges();
        },
      });
  }

  //*********************************************************** */
  private loadCatalogs(): void {
    this.http
      .get<{ data: any }>(`${environment.apiUrl}/companies?limit=100`)
      .subscribe((res) => {
        const wrapper = res?.data || res;
        this.companiesCatalog = wrapper?.data || wrapper || [];
      });
    this.http
      .get<{ data: any }>(`${environment.apiUrl}/branches?limit=100`)
      .subscribe((res) => {
        const wrapper = res?.data || res;
        this.branchesCatalog = wrapper?.data || wrapper || [];
      });

    // 🎯 INYECCIÓN DE SEGURIDAD DINÁMICA: Jalamos los roles reales guardados en Aiven
    this.http
      .get<{ data: any[] }>(`${environment.apiUrl}/security/roles`)
      .subscribe((res) => {
        this.rolesCatalog = res?.data || [];
        this.cdr.detectChanges();
      });
  }

  // 📐 GETTER RECTIVO PARA MANIPULAR EL BUCLE DINÁMICO EN EL HTML
  get assignmentsFormArray(): FormArray {
    return this.userForm.get('assignments') as FormArray;
  }

  // 📝 DISPARADOR: Inicializa el formulario limpio para CREAR
  openCreateModal(): void {
    this.isEditMode = false;
    this.editingUserId = null;
    this.errorMessage = null;
    this.successMessage = null;

    this.userForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      address: [''],
      password: [
        '',
        this.isEditMode ? [] : [Validators.required, Validators.minLength(6)],
      ], // Clave genérica obligatoria solo en creación
      assignments: this.fb.array([this.createAssignmentGroup()]), // Nace con 1 local listo
    });

    this.showModal = true;
    this.cdr.detectChanges();
  }

  // 📝 DISPARADOR: Inicializa el formulario poblado para EDITAR
  openEditModal(user: any): void {
    this.isEditMode = true;
    this.editingUserId = user.id;
    this.errorMessage = null;
    this.successMessage = null;

    this.userForm = this.fb.group({
      name: [user.name, [Validators.required, Validators.minLength(3)]],
      email: [
        { value: user.email, disabled: true },
        [Validators.required, Validators.email],
      ], // Email inmutable
      phone: [user.phone || ''],
      address: [user.address || ''],
      password: [''], // Vacío en edición (No altera credencial)
      assignments: this.fb.array([]),
    });

    // Repoblamos el FormArray dinámico con sus locales activos de Aiven
    if (user.assignments && user.assignments.length > 0) {
      user.assignments.forEach((a: any) => {
        this.assignmentsFormArray.push(
          this.fb.group({
            companyId: [a.companyId, Validators.required],
            branchId: [a.branchId, Validators.required],
            roleInput: [a.roleName, Validators.required], // Captura el string del rol
          }),
        );
      });
    } else {
      this.assignmentsFormArray.push(this.createAssignmentGroup());
    }

    this.showModal = true;
    this.cdr.detectChanges();
  }

  // Estructura de fila atómica para el bucle
  private createAssignmentGroup(): FormGroup {
    return this.fb.group({
      companyId: ['', Validators.required],
      branchId: ['', Validators.required],
      roleInput: ['', Validators.required], // Rol por defecto sugerido
    });
  }

  // Botón dinámico: Añadir otra fila de sucursal
  addAssignmentRow(): void {
    this.assignmentsFormArray.push(this.createAssignmentGroup());
    this.cdr.detectChanges();
  }

  // Botón dinámico: Quitar fila de sucursal
  removeAssignmentRow(index: number): void {
    if (this.assignmentsFormArray.length > 1) {
      this.assignmentsFormArray.removeAt(index);
    }
    this.cdr.detectChanges();
  }

  // 💾 GRABADO MÁSTER OPERATIVO EN LA NUBE (POST / PUT MULTI-FLOW)
   onSaveUser(): void {
    console.log('================ 💾 PROCESANDO GUARDADO DE PERSONAL ================');
    
    // 1. 🛡️ DETECTOR DE VALIDEZ: Si el formulario es inválido, forzamos el pintado de alertas rojas
    if (this.userForm.invalid) {
      console.warn('❌ Formulario inválido. Campos requeridos vacíos o erróneos.');
      this.userForm.markAllAsTouched();
      this.errorMessage = 'Por favor, complete todos los campos requeridos y asigne correctamente las tiendas del colaborador.';
      this.cdr.detectChanges();
      return;
    }

    // Si los datos son válidos, encendemos el spinner de bloqueo de red
    this.isActionLoading = true;
    this.errorMessage = null;
    this.successMessage = null;
    this.cdr.detectChanges();

    const rawAssignments = this.userForm.getRawValue().assignments;
    const formattedAssignments = rawAssignments.map((a: any) => ({
      companyId: Number(a.companyId),
      branchId: Number(a.branchId),
      roleNames: [String(a.roleInput).trim().toLowerCase()]
    }));

    if (!this.isEditMode) {
      // 🚀 FLUJO A: CREACIÓN DE COLABORADOR (POST)
      const payload = { ...this.userForm.getRawValue(), assignments: formattedAssignments };
      
      this.http.post<{ message: string }>(`${environment.apiUrl}/security/register-subuser`, payload).subscribe({
        next: (res) => {
          this.showModal = false;
          this.isActionLoading = false; // 🎯 DESTRABE: Apaga el bloqueo
          this.successMessage = res?.message || 'Colaborador creado y notificado con éxito.';
          this.loadUsers();
        },
        error: (err) => {
          this.isActionLoading = false; // 🎯 DESTRABE: Libera los botones
          this.errorMessage = err?.error?.message || 'Error en el cortafuegos de registro.';
          this.cdr.detectChanges();
        }
      });
    } else {
      // 🚀 FLUJO B: EDICIÓN DE ASIGNACIONES REAL EN AIVEN (PUT)
      const payload = { assignments: formattedAssignments };
      console.log(`📡 Enviando PUT hacia Aiven para el usuario: [${this.editingUserId}]`, payload);
      
      this.http.put<{ message: string }>(`${environment.apiUrl}/security/subusers/${this.editingUserId}`, payload).subscribe({
        next: (res) => {
          this.showModal = false;
          this.isActionLoading = false; // 🎯 DESTRABE: Libera los botones de la grilla
          this.successMessage = res?.message || 'Matriz de asignaciones actualizada con éxito en Aiven.';
          console.log('✅ Base de datos actualizada correctamente.');
          this.loadUsers(); // 🔄 Sincroniza la grilla con los nuevos cambios de la nube
        },
        error: (err) => {
          this.isActionLoading = false; // 🎯 DESTRABE: Libera los botones ante fallas de red
          this.errorMessage = err?.error?.message || 'Error actualizando asignaciones en el servidor.';
          this.cdr.detectChanges();
        }
      });
    }
  }
  //***************************************** */
  getBranchesByRowCompany(index: number): any[] {
    if (!this.userForm || !this.assignmentsFormArray) return [];

    // 1. Extraemos de forma segura el grupo reactivo de la fila correspondiente
    const rowGroup = this.assignmentsFormArray.at(index);
    const selectedCompanyId = rowGroup?.get('companyId')?.value;

    if (!selectedCompanyId) {
      return []; // Si no hay empresa seleccionada, el combo de locales nace vacío
    }

    // 2. Filtramos el catálogo global comparando contra el companyId (ambos convertidos a número)
    return this.branchesCatalog.filter(
      (b) => Number(b.companyId) === Number(selectedCompanyId),
    );
  }

  onResendActivation(email: string): void {
    this.isActionLoading = true;
    this.successMessage = null;
    this.errorMessage = null;
    this.cdr.detectChanges();

    console.log(`📡 [RADAR CRUD] Solicitando reenvío de credenciales para: [${email}]`);

    this.http.post<{ message: string }>(`${environment.apiUrl}/auth/resend-verification`, { email }).subscribe({
      next: (res) => {
        this.isActionLoading = false;
        this.successMessage = res?.message || 'Nuevo enlace de activación despachado con éxito.';
        this.loadUsers(); // Refrescamos la grilla por si acaso
      },
      error: (err) => {
        this.isActionLoading = false;
        this.errorMessage = err?.error?.message || 'Error en el servidor al procesar el reenvío.';
        this.cdr.detectChanges();
      }
    });
  }
}
