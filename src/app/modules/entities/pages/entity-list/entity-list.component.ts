import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, Subscription, combineLatest } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';

export interface ParameterOption {
  id: number;
  code: string;
  name: string;
}

export interface EntityCustomer {
  id: number;
  entityType: 'persona' | 'empresa';
  documentType: string;
  documentNumber: string;
  name: string;
  email: string | null;
  DocumentParameter?: {
    name: string;
  };
}

@Component({
  selector: 'app-entity-list',
  templateUrl: './entity-list.component.html',
  styleUrls: ['./entity-list.component.css'],
})
export class EntityListComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder); // 👈 Inyectamos FormBuilder para el DataEntry
  private cdr = inject(ChangeDetectorRef);
  private readonly API_URL = `${environment.apiUrl}/entities`;

  // Colección de datos reales de MySQL
  entities: EntityCustomer[] = [];
  identityTypesList: ParameterOption[] = [];
  // Variables del estado de la Rejilla de Datos
  totalRecords = 0;
  currentPage = 1;
  pageSize = 10;
  isLoading = false;

  // Ordenamiento
  sortField = 'id';
  sortOrder: 'asc' | 'desc' = 'desc';

  // Modelos de Filtros Avanzados
  filterDocumentType = '';
  filterDocumentNumber = '';
  filterName = '';
  filterEmail = '';

  // 🎛️ ESTADOS CONTROLADORES DE LA VENTANA MODAL EMERGENTE (DATAENTRY)
  entityForm!: FormGroup;
  showModal = false;
  isEditing = false;
  selectedEntityId: number | null = null;
  formErrorMessage: string | null = null;

  // Canales de control RxJS para evitar fugas de memoria
  private searchSubject = new Subject<void>();
  private contextSubscription!: Subscription;

  activeCommercialTab: 'perfil' | 'credito' = 'perfil';

  ngOnInit(): void {
    this.initForm(); // 🚀 Inicializamos los validadores reactivos de entrada
    this.loadEntityParametricCatalogs();
    this.contextSubscription = combineLatest([
      this.authService.activeCompanyId$,
      this.authService.activeBranchId$,
    ]).subscribe(([companyId, branchId]) => {
      if (companyId && branchId) {
        this.resetFilters();
        this.loadEntities();
      }
    });

    this.searchSubject.pipe(debounceTime(350)).subscribe(() => {
      this.currentPage = 1;
      this.loadEntities();
    });
  }

  ngOnDestroy(): void {
    if (this.contextSubscription) {
      this.contextSubscription.unsubscribe();
    }
  }

  // 📝 ESTRUCTURA DE VALIDACIONES REACTIVAS DNI / RUC
  private initForm(): void {
    this.entityForm = this.fb.group({
      entityType: ['persona', [Validators.required]], // Nace como persona por defecto
      documentType: ['', [Validators.required]],
      documentNumber: ['', [Validators.required]],
      name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.email]],
      address: [''],
      phone: ['']
    });

    // 🚀 ESCUCHADOR MAESTRO CORREGIDO PARA EL MAESTRO DE ENTIDADES
    this.entityForm.get('documentType')?.valueChanges.subscribe((type) => {
      const docNumControl = this.entityForm.get('documentNumber');
      const typeControl = this.entityForm.get('entityType');
      if (!docNumControl || !typeControl) return;

      docNumControl.clearValidators();
      const typeStr = String(type);

      if (typeStr === '6') {
        // 🏢 Si selecciona RUC, forzamos de forma automatizada que el tipo sea 'empresa'
        typeControl.setValue('empresa', { emitEvent: false });
        docNumControl.setValidators([
          Validators.required,
          Validators.pattern('^(10|15|17|20)[0-9]{9}$') // 🌟 Formato string nativo de Angular
        ]);
      } else {
        // 👤 Si es DNI, Pasaporte o CE, forzamos de forma automatizada que sea 'persona'
        typeControl.setValue('persona', { emitEvent: false });
        
        if (typeStr === '1') {
          docNumControl.setValidators([
            Validators.required,
            Validators.pattern('^[0-9]{8}$') // 🌟 Formato string nativo para DNI
          ]);
        } else {
          docNumControl.setValidators([
            Validators.required,
            Validators.pattern('^[a-zA-Z0-9]{6,15}$')
          ]);
        }
      }

      docNumControl.updateValueAndValidity();
      this.cdr.detectChanges();
    });
  }

  private handleEntityFormError(err: any): void {
    this.isLoading = false;

    // 🌟 CAPTURA RADAR EXTREMA: Extraemos el 'message' detallado que envía el middleware
    this.formErrorMessage =
      err?.error?.message ||
      err?.error?.error ||
      err?.message ||
      'Error de comunicación con la API.';

    console.error('🕵️‍♂️ RADAR CLIENTE - Detalle de error capturado:', err);
    this.cdr.detectChanges();
  }

  changeEntityTypeMode(mode: 'persona' | 'empresa'): void {
    const typeControl = this.entityForm.get('entityType');
    const docTypeControl = this.entityForm.get('documentType');

    if (!typeControl || !docTypeControl) return;

    if (mode === 'empresa') {
      // Si es empresa, forzamos la propiedad y clavamos estrictamente el RUC ('6')
      typeControl.setValue('empresa');
      docTypeControl.setValue('6');
    } else {
      // Si es persona natural, abrimos el formulario y pre-seleccionamos DNI ('1')
      typeControl.setValue('persona');
      docTypeControl.setValue('1');
    }

    this.formErrorMessage = null; // Limpiamos alertas para dar fluidez
    this.cdr.detectChanges(); // Fuerza a Angular a redibujar el modal
  }

  loadEntityParametricCatalogs(): void {
    // Apuntamos directo al router que ya tiene la lógica de filtrado por mayúsculas
    const url = `${environment.apiUrl}/products/parameters?type=TIPO_DOCUMENTO_IDENTIDAD`;

    this.http.get<{ status: string; data: ParameterOption[] }>(url).subscribe({
      next: (res) => {
        const wrapper = res?.data || res;
        this.identityTypesList = Array.isArray(wrapper) ? wrapper : [];

        // Fallback defensivo por si la tabla de parámetros estuviera vacía en el entorno
        if (this.identityTypesList.length === 0) {
          this.identityTypesList = [
            { id: 12, code: '1', name: 'DNI' },
            { id: 13, code: '6', name: 'RUC' },
            { id: 14, code: '4', name: 'CARNET EXTRANJERIA' },
          ];
        }

        // Si es modo creación, pre-posicionamos el primer parámetro válido en el formulario
        if (
          this.identityTypesList.length > 0 &&
          this.entityForm.get('documentType')?.value === ''
        ) {
          this.entityForm
            .get('documentType')
            ?.setValue(this.identityTypesList[0].code);
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(
          'Error al recuperar catálogo de identidades para entidades:',
          err,
        );
        this.cdr.detectChanges();
      },
    });
  }

  loadEntities(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    let url = `${this.API_URL}?page=${this.currentPage}&limit=${this.pageSize}&sortField=${this.sortField}&sortOrder=${this.sortOrder}`;

    if (this.filterDocumentType)
      url += `&documentType=${this.filterDocumentType}`;
    if (this.filterDocumentNumber.trim())
      url += `&documentNumber=${this.filterDocumentNumber.trim()}`;
    if (this.filterName.trim())
      url += `&name=${encodeURIComponent(this.filterName.trim())}`;
    if (this.filterEmail.trim())
      url += `&email=${encodeURIComponent(this.filterEmail.trim())}`;

    this.http.get<{ data: any[]; total: number }>(url).subscribe({
      next: (res: any) => {
        this.entities = res?.data || [];
        this.totalRecords = res?.total || 0;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.entities = [];
        this.totalRecords = 0;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  // =========================================================================
  // 💾 GESTORES OPERATIVOS DEL DATAENTRY MODAL (CREAR / EDITAR / GUARDAR)
  // =========================================================================
  openCreateModal(): void {
    this.isEditing = false;
    this.selectedEntityId = null;
    this.formErrorMessage = null;

    // Reseteamos el formulario posicionando los valores limpios por defecto
    this.entityForm.reset({
      entityType: 'persona',
      documentType: 'dni',
      name: '',
      documentNumber: '',
      email: '',
    });
    this.showModal = true;
    this.cdr.detectChanges();
  }

  onEdit(entity: EntityCustomer): void {
    this.isEditing = true;
    this.selectedEntityId = entity.id;
    this.formErrorMessage = null;
    // Inyectamos los datos de la fila de MySQL dentro de los inputs del formulario
    this.entityForm.patchValue({
      entityType: entity.entityType,
      documentType: entity.documentType,
      documentNumber: entity.documentNumber,
      name: entity.name,
      email: entity.email,
    });
    this.showModal = true;
    this.cdr.detectChanges();
  }

  closeModal(): void {
    this.showModal = false;
    this.cdr.detectChanges();
  }

  onFormSubmit(): void {
    if (this.entityForm.invalid) {
      this.entityForm.markAllAsTouched(); // Enciende las alertas rojas visuales si hay campos vacíos
      return;
    }

    this.isLoading = true;
    this.formErrorMessage = null;

    // Estructuramos el payload limpio adaptado a tu Zod Schema del backend
    const payload = {
      entityType: this.entityForm.value.entityType,
      documentType: this.entityForm.value.documentType,
      documentNumber: this.entityForm.value.documentNumber.toString().trim(),
      name: this.entityForm.value.name.trim(),
      email: this.entityForm.value.email?.trim() || null,
    };

    if (this.isEditing && this.selectedEntityId) {
      // Caso A: Actualización (PUT)
      this.http
        .put(`${this.API_URL}/${this.selectedEntityId}`, payload)
        .subscribe({
          next: () => this.handleSuccessSubmit(),
          error: (err: any) => this.handleErrorSubmit(err),
        });
    } else {
      // Caso B: Registro Nuevo (POST)
      this.http.post(this.API_URL, payload).subscribe({
        next: () => this.handleSuccessSubmit(),
        error: (err: any) => this.handleErrorSubmit(err),
      });
    }
  }

  private handleSuccessSubmit(): void {
    this.isLoading = false;
    this.closeModal();
    this.loadEntities(); // Recarga la tabla de inmediato mostrando el nuevo registro insertado
  }

  private handleErrorSubmit(err: any): void {
    this.isLoading = false;
    this.formErrorMessage =
      err.error?.message ||
      'Error al procesar la solicitud en MySQL. Verifique los campos.';
    this.cdr.detectChanges();
  }

  // Utilidades complementarias de la Rejilla
  onFilterChange(): void {
    this.searchSubject.next();
  }
  onPageSizeChange(newSize: number): void {
    this.pageSize = Number(newSize);
    this.currentPage = 1;
    this.loadEntities();
  }
  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadEntities();
    }
  }
  get totalPages(): number {
    return Math.ceil(this.totalRecords / this.pageSize) || 1;
  }
  changeOrder(field: string): void {
    if (this.sortField === field) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortOrder = 'asc';
    }
    this.loadEntities();
  }
  onSearch(): void {
    this.searchSubject.next();
  }
  resetFilters(): void {
    this.filterDocumentType = '';
    this.filterDocumentNumber = '';
    this.filterName = '';
    this.filterEmail = '';
    this.currentPage = 1;
  }
  onDelete(id: number): void {
    if (confirm('¿Dar de baja a esta entidad comercial?')) {
      this.http
        .delete(`${this.API_URL}/${id}`)
        .subscribe(() => this.loadEntities());
    }
  }

  // Función auxiliar visual para encender clases CSS de error en los inputs
  isFieldInvalid(fieldName: string): boolean {
    const field = this.entityForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }
}
