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

export interface EntityCustomer {
  id: number;
  entityType: 'persona' | 'empresa';
  documentType: 'dni' | 'ruc' | 'pasaporte' | 'ce' | 'otros';
  documentNumber: string;
  name: string;
  email: string | null;
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
  private readonly API_URL = 'http://localhost:3000/api/entities';

  // Colección de datos reales de MySQL
  entities: EntityCustomer[] = [];

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

  ngOnInit(): void {
    this.initForm(); // 🚀 Inicializamos los validadores reactivos de entrada

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
      entityType: ['persona', [Validators.required]],
      documentType: ['dni', [Validators.required]],
      documentNumber: [
        '',
        [Validators.required, Validators.pattern(/^\d{8}$/)],
      ], // 8 dígitos numéricos de inicio
      name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.email]],
    });

    // 🔄 ESCUCHA REACTIVA: Si el usuario cambia el radio button, mutamos las reglas en caliente
    this.entityForm.get('entityType')?.valueChanges.subscribe((type) => {
      const docTypeControl = this.entityForm.get('documentType');
      const docNumControl = this.entityForm.get('documentNumber');

      if (type === 'empresa') {
        docTypeControl?.setValue('ruc');
        // Exige estrictamente 11 dígitos numéricos puros para Empresas (RUC)
        docNumControl?.setValidators([
          Validators.required,
          Validators.pattern(/^\d{11}$/),
        ]);
      } else {
        docTypeControl?.setValue('dni');
        // Exige estrictamente 8 dígitos numéricos puros para Personas (DNI)
        docNumControl?.setValidators([
          Validators.required,
          Validators.pattern(/^\d{8}$/),
        ]);
      }
      docTypeControl?.updateValueAndValidity();
      docNumControl?.updateValueAndValidity();
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
