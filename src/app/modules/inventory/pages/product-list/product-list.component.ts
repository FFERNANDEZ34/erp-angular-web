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

  private loadFormParameters(): void {

    const url = `${environment.apiUrl}/products/parameters`;

    // El interceptor adjuntará de forma transparente las cabeceras de seguridad
    combineLatest([
      this.http.get<{ data: ParameterOption[] }>(`${url}?type=CATEGORIA`),
      this.http.get<{ data: ParameterOption[] }>(`${url}?type=MARCA`),
      this.http.get<{ data: ParameterOption[] }>(`${url}?type=MONEDA`),
      this.http.get<{ data: ParameterOption[] }>(`${url}?type=TIPO_AFECTACION_IGV`),
      this.http.get<{ data: ParameterOption[] }>(`${url}?type=UNIDAD_MEDIDA`),
    ]).subscribe({
      next: ([cats, brands, curs, taxes, units]) => {
        this.categoriesList = cats.data || [];
        this.brandsList = brands.data || [];
        this.currenciesList = curs.data || [];
        this.taxesList = taxes.data || [];
        this.unitsList = units.data || [];

        // Seteamos dinámicamente los primeros elementos válidos por defecto en el FormGroup si las listas no vienen vacías
        if (this.currenciesList.length > 0)
          this.productForm
            .get('currencyParamId')
            ?.setValue(this.currenciesList[0].id);
        if (this.taxesList.length > 0)
          this.productForm
            .get('taxTypeParamId')
            ?.setValue(this.taxesList[0].id);
        if (this.unitsList.length > 0)
          this.productForm
            .get('unitMeasureParamId')
            ?.setValue(this.unitsList[0].id);

        this.cdr.detectChanges();
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
      categoryId: [10, [Validators.required]],
      brandId: [11, [Validators.required]],
      currencyParamId: [4, [Validators.required]],
      taxTypeParamId: [4, [Validators.required]],
      unitMeasureParamId: [8, [Validators.required]],
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
      categoryId: 10,
      brandId: 11,
      currencyParamId: 4,
      taxTypeParamId: 4,
      unitMeasureParamId: 8,
      purchasePrice: 0,
      salesPrice: 0,
      minimumStock: 0,
      isPackage: false,
      allowSearch: true,
    });
    this.activeTab = 'datos';
    this.showModal = true;
    this.cdr.detectChanges();
  }

  loadProductAttachments(): void {
    if (!this.selectedProductId) return;

    // private readonly API_URL = `${environment.apiUrl}/products`;

    const url = `${this.ATTACHMENT_API_URL}?module=PRODUCTOS&recordId=${this.selectedProductId}`;
    this.http.get<{ data: any[] }>(url).subscribe({
      next: (res) => {
        this.productImages = res?.data || [];
        this.cdr.detectChanges();
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
      'x-is-main-photo': (this.productImages.length === 0).toString()
    };

    

    this.http.post(`${this.ATTACHMENT_API_URL}/upload`, formData, { headers }).subscribe({
      next: () => {
        this.isUploadingFile = false;
        this.loadProductAttachments(); // Recarga la grilla
        event.target.value = '';
      },
      error: (err) => {
        this.isUploadingFile = false;
        alert(err?.error?.message || 'Error en la subida binaria.');
        this.cdr.detectChanges();
      }
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
      error: (err) => console.error('Error al conmutar la foto por default:', err)
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
    this.cdr.detectChanges();
  }

  onFormSubmit(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
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
    this.formErrorMessage = err?.error?.message || err?.message || 'Error inesperado al procesar el inventario.';
    
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
    const field = this.productForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }
}