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
import { debounceTime } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment'; // 👈 1. IMPORTAR
import { JsonPipe } from '@angular/common';

export interface ProductItem {
  id: number;
  productCode: string;
  name: string;
  description: string | null;
  sku: string | null;
  barCode: string | null;
  salesPrice: number;
  salesValue: number;
  purchasePrice: number;
  purchaseValue: number;
  minimumStock: number;
  categoryId: number;
  brandId: number;
  currencyParamId: number;
  taxTypeParamId: number;
  unitMeasureParamId: number;
  Category?: { id: number; name: string };
  Brand?: { id: number; name: string };
  Currency?: { id: number; name: string };
}

export interface ParameterOption {
  id: number;
  code: string;
  name: string;
}

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.css'],
})
export class ProductListComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  private readonly API_URL = `${environment.apiUrl}/products`;
  private readonly ATTACHMENT_API_URL = `${environment.apiUrl}/attachments`;
  public readonly STORAGE_BASE = environment.storageUrl;

  products: ProductItem[] = [];
  totalRecords = 0;
  currentPage = 1;
  pageSize = 10;
  isLoading = false;
  sortField = 'id';
  sortOrder: 'asc' | 'desc' = 'desc';

  // 🔍 Variables del Panel de Filtros
  filterProductCode = '';
  filterName = '';
  filterCategoryId = '';

  // 🎛️ Estados de la Ventana Modal
  productForm!: FormGroup;
  showModal = false;
  isEditing = false;
  selectedProductId: number | null = null;
  formErrorMessage: string | null = null;

  // Nace posicionada por defecto en la primera pestaña 'datos'
  activeTab: 'datos' | 'precios' | 'almacen' | 'adjuntos' = 'datos';

  private searchSubject = new Subject<void>();
  private contextSubscription!: Subscription;

  productImages: any[] = [];
  isUploadingFile = false;

  categoriesList: ParameterOption[] = [];
  brandsList: ParameterOption[] = [];
  currenciesList: ParameterOption[] = [];
  taxesList: ParameterOption[] = [];
  unitsList: ParameterOption[] = [];

  getCurrencySymbol(currencyCode: string): string {
    if (!currencyCode) return '';

    const codeStr = String(currencyCode).trim().toUpperCase();

    // Matriz de glifos comerciales. Si mañana cambia la ley, solo alteras este objeto de texto
    const symbolDictionary: { [key: string]: string } = {
      PEN: 'S/',
      USD: '$',
      EUR: '€',
    };

    // Retorna el símbolo del diccionario. Si no existe la moneda, muestra su código base por defecto
    return symbolDictionary[codeStr] || codeStr;
  }

   private loadFormParameters(): void {
    // 🔌 Declaramos los dos destinos de red según la procedencia de los datos
    const parametersUrl = `${environment.apiUrl}/products/parameters`;
    const productsBaseUrl = `${environment.apiUrl}/products`;

    console.log('📡 [COMBINE_LATEST SaaS] Sincronizando catálogos mixtos (Globales + Multi-Company)...');

    // Despachamos el pool de peticiones en paralelo a la velocidad del rayo
    combineLatest([
      // 🎯 NUEVAS TABLAS: Categorías y Marcas independientes aisladas por tu companyId
      this.http.get<{ data: ParameterOption[] }>(`${productsBaseUrl}/categories`),
      this.http.get<{ data: ParameterOption[] }>(`${productsBaseUrl}/brands`),
      
      // 🔌 TABLA AUXILIAR: Catálogos regulatorios universales de la SUNAT
      this.http.get<{ data: ParameterOption[] }>(`${parametersUrl}?type=MONEDA`),
      this.http.get<{ data: ParameterOption[] }>(`${parametersUrl}?type=TIPO_AFECTACION_IGV`),
      this.http.get<{ data: ParameterOption[] }>(`${parametersUrl}?type=UNIDAD_MEDIDA`),
    ]).subscribe({
      next: ([cats, brands, curs, taxes, units]) => {
        // 1. Poblamos de forma líquida las colecciones reactivas de tu monitor
        this.categoriesList = cats.data || [];
        this.brandsList = brands.data || [];
        this.currenciesList = curs.data || [];
        this.taxesList = taxes.data || [];
        this.unitsList = units.data || [];

        // 2. Seteamos dinámicamente los elementos válidos por defecto (Tu lógica intacta)
        if (this.currenciesList.length > 0) {
          this.productForm.get('currencyParamId')?.setValue(this.currenciesList[0].id);
        }
        if (this.taxesList.length > 0) {
          this.productForm.get('taxTypeParamId')?.setValue(this.taxesList[0].id);
        }
        if (this.unitsList.length > 0) {
          this.productForm.get('unitMeasureParamId')?.setValue(this.unitsList[0].id);
        }

        this.cdr.detectChanges(); // 🔥 Forzamos el repintado en caliente en tu monitor de Angular
      },
      error: (err) =>
        console.error('Error al alimentar los catálogos del inventario:', err),
    });
  }

  ngOnInit(): void {
    this.initForm();
    this.loadFormParameters();
    // Escucha dual reactiva: Empresa y Sucursal activa
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
    if (this.contextSubscription) this.contextSubscription.unsubscribe();
  }

  private initForm(): void {
    this.productForm = this.fb.group({
      productCode: ['', [Validators.required, Validators.minLength(2)]],
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      sku: [''],
      barCode: [''],
      // 🎯 EL DESTRABE EN LA RAM: Mutamos '' a null para forzar el estado INVALID nativo
      categoryId: ['', [Validators.required]],
      brandId: ['', [Validators.required]],
      currencyParamId: ['', [Validators.required]],
      taxTypeParamId: ['', [Validators.required]],

      unitMeasureParamId: [8, [Validators.required]], // Nace con 8 por defecto (Sigue intacto)
      purchasePrice: [0, [Validators.required, Validators.min(0.01)]],
      salesPrice: [0, [Validators.required, Validators.min(0.01)]],
      minimumStock: [0, [Validators.required, Validators.min(0)]],
      isPackage: [false],
      allowSearch: [true],
    });
  }

  loadEntities(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    let url = `${this.API_URL}?page=${this.currentPage}&limit=${this.pageSize}&sortField=${this.sortField}&sortOrder=${this.sortOrder}`;

    if (this.filterProductCode.trim())
      url += `&productCode=${this.filterProductCode.trim()}`;
    if (this.filterName.trim())
      url += `&name=${encodeURIComponent(this.filterName.trim())}`;
    if (this.filterCategoryId) url += `&categoryId=${this.filterCategoryId}`;

    this.http
      .get<{ status: string; data: { data: any[]; total: number } }>(url)
      .subscribe({
        next: (res: any) => {
          const wrapper = res?.data || res;
          this.products = wrapper?.data || [];
          this.totalRecords = wrapper?.total || 0;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.products = [];
          this.totalRecords = 0;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

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
    this.sortField = field;
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    this.loadEntities();
  }
  resetFilters(): void {
    this.filterProductCode = '';
    this.filterName = '';
    this.filterCategoryId = '';
    this.currentPage = 1;
  }

  openCreateModal(): void {
    this.isEditing = false;
    this.selectedProductId = null;
    this.formErrorMessage = null;
    this.productForm.reset({
      productCode: '',
      name: '',
      description: '',
      sku: '',
      barCode: '',
      
      // Nacen vacíos para obligar a que falle Validators.required y encienda el rojo
      categoryId: '',
      brandId: '',
      currencyParamId: '',
      taxTypeParamId: '',
      
      // El de unidad de medida puedes dejarlo en 8 si deseas que 'Unidades' sea el default de la SUNAT,
      // o ponerlo en '' si también quieres obligar a que lo seleccionen a mano.
      unitMeasureParamId: '', 
      
      purchasePrice: 0,
      salesPrice: 0,
      minimumStock: 0,
      isPackage: false,
      allowSearch: true
    });

    this.productForm.updateValueAndValidity();

    this.activeTab = 'datos';
    this.showModal = true;
    this.cdr.detectChanges();
  }

  loadProductAttachments(): void {
    if (!this.selectedProductId) return;

    const url = `${this.ATTACHMENT_API_URL}?module=PRODUCTOS&recordId=${this.selectedProductId}`;

    this.http.get<{ data: any[] }>(url).subscribe({
      next: (res) => {
        // 1. Poblamos tu array real de la galería
        this.productImages = res?.data || [];

        // 2. 🎯 EL DESTRABE VISUAL EN TU MONITOR:
        // Buscamos dentro de la galería cloud si alguna foto es la estrella principal
        const mainPhotoRow = this.productImages.find(
          (img) => img.isMainPhoto === true || img.isMainPhoto === 1,
        );

        if (mainPhotoRow) {
          console.log(
            '📸 Portada localizada en Cloudflare R2:',
            mainPhotoRow.fileUrl,
          );

          // Sincronizamos tu FormGroup reactivo de la vista
          if (this.productForm) {
            // Buscamos cuál es el nombre de tu control de foto (imageUrl, fileUrl o mainPhoto)
            const targetControl =
              this.productForm.get('imageUrl') ||
              this.productForm.get('fileUrl') ||
              this.productForm.get('mainPhoto');
            if (targetControl) {
              targetControl.setValue(mainPhotoRow.fileUrl);
            }
          }
        } else {
          // Fallback: Si no hay estrella principal, limpiamos el control para que pinte el logo vacío
          if (this.productForm) {
            const targetControl =
              this.productForm.get('imageUrl') ||
              this.productForm.get('fileUrl');
            if (targetControl) targetControl.setValue('');
          }
        }

        this.cdr.detectChanges(); // 🔥 Repintado inmediato en tu monitor de Angular
      },
      error: (err) =>
        console.error('Error al recuperar galería de adjuntos:', err),
    });
  }

  // E. 📥 EMISIÓN MULTIPART BINARIA VIA FORM-DATA CONTRA EL BÚNKER POLIMÓRFICO
  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (!file || !this.selectedProductId) return;

    this.isUploadingFile = true;
    this.cdr.detectChanges();

    const formData = new FormData();
    formData.append('file', file);

    // 🌟 LA REGLA DE ORO: Inyectamos la metadata en los HEADERS para la API transversal polimórfica
    const headers = {
      'x-related-module': 'PRODUCTOS',
      'x-related-record-id': this.selectedProductId.toString(),
      'x-is-main-photo': (this.productImages.length === 0).toString(),
    };

    this.http
      .post(`${this.ATTACHMENT_API_URL}/upload`, formData, { headers })
      .subscribe({
        next: () => {
          this.isUploadingFile = false;
          this.loadProductAttachments(); // Recarga la grilla
          event.target.value = '';
        },
        error: (err) => {
          this.isUploadingFile = false;
          alert(err?.error?.message || 'Error en la subida binaria.');
          this.cdr.detectChanges();
        },
      });
  }

  // F. ⭐ CONMUTAR FOTO PRINCIPAL POR DEFAULT EN CALIENTE
  setMainPhoto(attachmentId: number): void {
    if (!this.selectedProductId) return;

    const url = `${this.ATTACHMENT_API_URL}/${attachmentId}/main`;
    const payload = { relatedRecordId: this.selectedProductId };

    this.http.patch(url, payload).subscribe({
      next: () => {
        // 🌟 Refresca de inmediato la galería en pantalla para recalcular las estrellas en vivo
        this.loadProductAttachments();
      },
      error: (err) =>
        console.error('Error al conmutar la foto por default:', err),
    });
  }

  onEdit(product: ProductItem): void {
    this.isEditing = true;
    this.selectedProductId = product.id;
    this.formErrorMessage = null;
    this.activeTab = 'datos'; // Nace en la pestaña 1
    this.productImages = []; // Resetea el carrete previo
    this.productForm.patchValue(product);
    this.loadProductAttachments();
    this.showModal = true;
    this.cdr.detectChanges();
  }

   closeModal(): void {
    this.showModal = false;
    this.formErrorMessage = null;
    this.productImages = []; // Limpiamos el carrete cloud de R2 para el siguiente artículo
    this.productForm.reset(); // Sanea la RAM del formulario
    this.cdr.detectChanges();
  }

  onFormSubmit(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.formErrorMessage = null;

    // 🎯 INTEGRACIÓN QUIRÚRGICA: Forzamos el casteo numérico de los IDs y precios
    // Esto destruye el rebote de ZodError al garantizar que viajen como 'number' primitivos
    const payload = {
      productCode: this.productForm.value.productCode?.trim(),
      name: this.productForm.value.name?.trim(),
      description: this.productForm.value.description?.trim() || null,
      sku: this.productForm.value.sku?.trim() || null,
      barCode: this.productForm.value.barCode?.trim() || null,

      // Convertimos los combos de strings a enteros puros para Zod
      categoryId: Number(this.productForm.value.categoryId),
      brandId: Number(this.productForm.value.brandId),
      currencyParamId: Number(this.productForm.value.currencyParamId),
      taxTypeParamId: Number(this.productForm.value.taxTypeParamId),
      unitMeasureParamId: Number(this.productForm.value.unitMeasureParamId),

      // Convertimos los decimales operativos
      purchasePrice: Number(this.productForm.value.purchasePrice),
      salesPrice: Number(this.productForm.value.salesPrice),
      minimumStock: Number(this.productForm.value.minimumStock),

      isPackage: !!this.productForm.value.isPackage,
      allowSearch: !!this.productForm.value.allowSearch,
    };

    console.log('🛰️ Despachando payload saneado al catálogo maestro:', payload);

//console.log(JSON.stringify(this.productForm));
console.log(JSON.stringify(payload));

    if (this.isEditing && this.selectedProductId) {
      this.http
        .put(`${this.API_URL}/${this.selectedProductId}`, payload)
        .subscribe({
          next: () => {
            this.isLoading = false;
            this.closeModal();
            this.loadEntities();
          },
          error: (err) => this.handleProductFormError(err),
        });
    } else {
      this.http.post(this.API_URL, payload).subscribe({
        next: () => {
          this.isLoading = false;
          this.closeModal();
          this.loadEntities();
        },
        error: (err) => this.handleProductFormError(err),
      });
    }
  }

  private handleProductFormError(err: any): void {
    this.isLoading = false;

    // Extraemos el mensaje literal enviado por el throw new Error de tu CreateProductUseCase
    this.formErrorMessage =
      err?.error?.message ||
      err?.message ||
      'Error inesperado al procesar el inventario.';

    console.error('Radar Inventario - Captura de excepción controlada:', err);
    this.cdr.detectChanges(); // Forzamos a Angular a pintar el cartel de alerta en pantalla
  }

  onDelete(id: number): void {
    if (
      confirm(
        '¿Está seguro de dar de baja este producto del catálogo comercial?',
      )
    ) {
      this.http
        .delete(`${this.API_URL}/${id}`)
        .subscribe(() => this.loadEntities());
    }
  }

  private handleError(err: any): void {
    this.isLoading = false;
    this.formErrorMessage =
      err?.error?.message || 'Error al procesar el inventario en MySQL.';
    this.cdr.detectChanges();
  }

  
  isFieldInvalid(fieldName: string): boolean {
    if (!this.productForm) return false;
    const field = this.productForm.get(fieldName);
    
    // 🛡️ Si el campo es inválido matemáticamente Y (fue tocado individualmente O se presionó Grabar)
    return !!(
      field && 
      field.invalid && 
      (field.dirty || field.touched || this.productForm.touched)
    );
  }
}
