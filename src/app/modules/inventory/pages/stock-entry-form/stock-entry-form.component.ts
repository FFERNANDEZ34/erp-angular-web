import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { KardexService } from '../../../../core/services/kardex.service';

@Component({
  selector: 'app-stock-entry-form',
  templateUrl: './stock-entry-form.component.html',
  styleUrls: ['./stock-entry-form.component.css']
})
export class StockEntryFormComponent implements OnInit {
  @ViewChild('errorBannerAnchor', { static: false }) errorBanner: ElementRef | undefined;

  entryForm!: FormGroup;
  productsList: any[] = [];
  isLoadingCatalogs = false;
  isSaving = false;
  formErrorMessage: string | null = null;

  // Variables de control para el Toast de éxito
  showSuccessToast = false;
  successToastMessage = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadProductsCatalog();
  }

  private initForm(): void {
    this.entryForm = this.fb.group({
      sourceDocument: ['', [Validators.required, Validators.minLength(3)]], // N° de Factura o Guía
      reason: ['COMPRA', [Validators.required]], // COMPRA, AJUSTE, DEVOLUCION
      items: this.fb.array([]) // Filas dinámicas de productos a ingresar
    });

    // Añadimos una primera fila vacía por defecto para que la pantalla no nazca pelada
    this.addDetailRow();
  }

  get detailsFormArray(): FormArray {
    return this.entryForm.get('items') as FormArray;
  }

  // 📋 Añadir una nueva fila al carrito de compras/ingresos
  addDetailRow(): void {
    const row = this.fb.group({
      productId: ['', [Validators.required]],
      quantity: [1, [Validators.required, Validators.min(1)]],
      purchasePrice: [0, [Validators.required, Validators.min(0.0001)]]
    });

    this.detailsFormArray.push(row);
    this.cdr.detectChanges();
  }

  // 🗑️ Eliminar una fila específica de la grilla
  removeDetailRow(index: number): void {
    if (this.detailsFormArray.length > 1) {
      this.detailsFormArray.removeAt(index);
    } else {
      this.detailsFormArray.clear();
      this.addDetailRow();
    }
    this.cdr.detectChanges();
  }

  // 📡 Jalamos el catálogo de productos disponibles para popular los combos
  private loadProductsCatalog(): void {
    this.isLoadingCatalogs = true;
    this.http.get<{ data: any }>(`${environment.apiUrl}/products?limit=200`).subscribe({
      next: (res: any) => {
        const wrapper = res?.data || res;
        this.productsList = wrapper?.data || [];
        this.isLoadingCatalogs = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando catálogo maestro:', err);
        this.isLoadingCatalogs = false;
        this.cdr.detectChanges();
      }
    });
  }

  // 💾 PROCESAR EN DISCO EL FORMULARIO HACIA NODE.JS (TRANSACCIÓN ACID)
  onSubmitIngress(): void {
    if (this.entryForm.invalid) {
      this.entryForm.markAllAsTouched();
      this.formErrorMessage = '⚠️ Por favor, complete todos los campos obligatorios del formulario.';
      this.cdr.detectChanges();
      return;
    }

    this.isSaving = true;
    this.formErrorMessage = null;
    this.cdr.detectChanges();

    const payload = this.entryForm.value;

    // Disparamos hacia nuestro nuevo endpoint transaccional del backend
    this.http.post(`${environment.apiUrl}/kardex/ingress`, payload).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.successToastMessage = res?.message || 'Ingreso consolidado con éxito en MySQL.';
        this.showSuccessToast = true;
        
        // Limpiamos el formulario por completo para el siguiente lote de mercadería
        this.detailsFormArray.clear();
        this.entryForm.reset({
          sourceDocument: '',
          reason: 'COMPRA'
        });
        this.addDetailRow();

        this.cdr.detectChanges();

        // Desvanecer Toast después de 4 segundos
        setTimeout(() => {
          this.showSuccessToast = false;
          this.cdr.detectChanges();
        }, 4000);
      },
      error: (err) => {
        this.isSaving = false;
        this.formErrorMessage = err?.error?.message || 'Error crítico al procesar el ingreso de existencias.';
        this.cdr.detectChanges();

        // 🚀 Scroll automático elegante hacia arriba enfocado al error
        if (this.errorBanner) {
          this.errorBanner.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
  }
}