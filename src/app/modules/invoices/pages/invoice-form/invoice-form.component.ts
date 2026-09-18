import {
  Component,
  OnInit,
  inject,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
} from '@angular/core'; // 🚀 CORRECCIÓN: Apunta a core
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router'; // 🚀 El Router sí pertenece a router
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { combineLatest, of } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-invoice-form',
  templateUrl: './invoice-form.component.html',
  styleUrls: ['./invoice-form.component.css'],
})
export class InvoiceFormComponent implements OnInit {
  @ViewChild('errorBannerAnchor', { static: false }) errorBanner:
    | ElementRef
    | undefined;
  @ViewChild('successToastAnchor', { static: false }) successToastElement:
    | ElementRef
    | undefined;

  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  private readonly API_URL = `${environment.apiUrl}/invoices`;
  private readonly SERIES_API = `${environment.apiUrl}/series`;
  private readonly ENTITIES_API = `${environment.apiUrl}/entities`;
  private readonly PRODUCTS_API = `${environment.apiUrl}/products`;

  // 📋 Repositorios para alimentar los Selectores de Caja
  seriesList: any[] = [];
  filteredSeries: any[] = [];
  customersList: any[] = [];
  productsList: any[] = [];
  identityTypesList: any[] = [];
  documentTypesList: any[] = []; // Para Factura, Boleta, Nota Pedido
  currenciesList: any[] = []; // Para Soles, Dólares
  taxTypesList: any[] = [];

  invoiceForm!: FormGroup;
  isLoading = false;
  formErrorMessage: string | null = null;

  // 📊 Acumuladores de Resumen para la vista
  totalGravada = 0;
  totalExonerada = 0;
  totalInafecta = 0;
  totalIgv = 0;
  totalVenta = 0;
  todayExchangeRateValue = 3.75;

  searchCustomerTerm = '';
  filteredCustomers: any[] = [];

  showCustomerModal = false;
  customerExpressForm!: FormGroup;
  isSavingCustomer = false;

  // 🌟 VARIABLES DE ESTADO PARA NOTIFICACIÓN PREMIUM
  showSuccessToast = false;
  successToastMessage = '';
  successInvoiceNumber = '';
  successInvoiceTotal = 0;

  // B. Inicializa el formulario express de clientes (Llama a esto al final de tu ngOnInit)
  initCustomerExpressForm(): void {
    this.customerExpressForm = this.fb.group({
      documentType: ['1', [Validators.required]],
      // 🌟 REAJUSTE ESTRICTO: El signo $ va libre sin la barra invertida
      documentNumber: [
        '',
        [Validators.required, Validators.pattern('^[0-9]{8}$')],
      ],
      name: ['', [Validators.required, Validators.minLength(3)]],
      address: [''],
      email: ['', [Validators.email]],
      phone: [''],
    });

    this.customerExpressForm
      .get('documentType')
      ?.valueChanges.subscribe((type) => {
        const numControl = this.customerExpressForm.get('documentNumber');
        if (!numControl) return;

        const typeStr = String(type);

        console.log(
          '================ 🕵️‍♂️ RADAR POS EXPRESS: CAMBIO DE COMBO ================',
        );
        console.log(
          '1. Código de documento seleccionado en el select:',
          `"${typeStr}"`,
        );
        console.log(
          '2. ¿Qué valor lee el HTML en este milisegundo?:',
          this.customerExpressForm.get('documentType')?.value,
        );

        numControl.clearValidators();

        if (typeStr === '6') {
          console.log(
            '➔ Aplicando validadores estrictos para: RUC (11 dígitos)',
          );
          numControl.setValidators([
            Validators.required,
            // 🌟 REAJUSTE ESTRICTO RUC: Exactamente 11 dígitos que empiecen con 10, 15, 17 o 20
            Validators.pattern('^(10|15|17|20)[0-9]{9}$'),
          ]);
        } else if (typeStr === '1') {
          console.log(
            '➔ Aplicando validadores estrictos para: DNI (8 dígitos)',
          );
          numControl.setValidators([
            Validators.required,
            // 🌟 REAJUSTE ESTRICTO DNI: Exactamente 8 dígitos
            Validators.pattern('^[0-9]{8}$'),
          ]);
        } else {
          console.log(
            '➔ Aplicando validadores flexibles para: Extranjería/Pasaporte',
          );
          numControl.setValidators([
            Validators.required,
            // 🌟 REAJUSTE ESTRICTO EXTRANJERÍA/PASAPORTE: Alfanumérico de 6 a 15
            Validators.pattern('^[a-zA-Z0-9]{6,15}$'),
          ]);
        }

        console.log(
          '3. ¿El control documentNumber quedó inválido?:',
          numControl.invalid,
        );
        console.log(
          '4. Errores activos del input ahora mismo:',
          numControl.errors,
        );
        console.log(
          '========================================================================',
        );

        numControl.updateValueAndValidity();
        this.cdr.detectChanges();
      });
  }
  openCustomerExpressModal(): void {
    this.formErrorMessage = null; // 💥 Pulveriza el mensaje de error anterior

    if (this.customerExpressForm) {
      this.customerExpressForm.reset({
        documentType: '1', // Setea DNI por defecto
        documentNumber: '',
        name: '',
        address: '',
        email: '',
        phone: '',
      });
    }

    this.showCustomerModal = true;
    this.cdr.detectChanges();
  }

  // C. 🔍 FILTRO PREDICTIVO EN CALIENTE: Filtra la lista de clientes en la RAM
  onSearchCustomer(): void {
    const term = this.searchCustomerTerm
      ? this.searchCustomerTerm.trim().toLowerCase()
      : '';

    if (!term) {
      this.filteredCustomers = [...this.customersList];
    } else {
      this.filteredCustomers = this.customersList.filter((c: any) => {
        const nombreCliente = (c.name || '').toLowerCase();
        const numeroDoc = (c.documentNumber || '').toLowerCase();

        // Evaluamos contra los atributos reales del Postman
        return nombreCliente.includes(term) || numeroDoc.includes(term);
      });
    }
    this.cdr.detectChanges();
  }

  // D. 💾 GRABADO EXPRESS DE CLIENTE CONTRA TU API DE ENTITIES
  onSubmitExpressCustomer(): void {
    if (this.customerExpressForm.invalid) {
      this.customerExpressForm.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    this.isSavingCustomer = true;
    this.formErrorMessage = null; // Limpiamos ruidos previos

    const formValues = this.customerExpressForm.value;
    const finalDocType = String(formValues.documentType).trim();
    const tipoEntidadReal = finalDocType === '6' ? 'empresa' : 'persona';

    const payload = {
      entityType: tipoEntidadReal,
      documentType: finalDocType,
      documentNumber: String(formValues.documentNumber).trim(),
      name: formValues.name.trim(),
      address: formValues.address?.trim() || null,
      email: formValues.email?.trim() || null,
      phone: formValues.phone?.trim() || null,
    };

    this.http.post(`${environment.apiUrl}/entities`, payload).subscribe({
      next: (res: any) => {
        const serverEntity = res?.data || res;
        //const newEntity = res?.data || res;
        this.isSavingCustomer = false;

        const newEntity = {
          ...serverEntity,
          address:
            serverEntity.address ||
            formValues.address?.trim() ||
            'DIRECCIÓN FISCAL NO REGISTRADA',
        };

        this.customersList.unshift(newEntity);
        this.searchCustomerTerm = '';
        this.filteredCustomers = [...this.customersList];

        this.invoiceForm.patchValue({ customerId: newEntity.id });

        this.showCustomerModal = false;
        this.customerExpressForm.reset();
        this.cdr.detectChanges();
        alert('Cliente registrado e inyectado a la venta con éxito total.');
      },
      error: (err) => {
        this.isSavingCustomer = false;
        // Captura amigáble el rebote controlado de tu caso de uso
        this.formErrorMessage =
          err?.error?.message || err?.message || 'Error físico en el holding.';
        this.cdr.detectChanges();
      },
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.invoiceForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }
  ngOnInit(): void {
    this.initForm();
    this.loadFormCatalogs();

    // ⚡ Escuchador Reactivo: Si cambian el tipo de documento (Factura/Boleta), recalculamos el talonario
    this.invoiceForm.get('documentType')?.valueChanges.subscribe((type) => {
      this.filterSeriesByDocType(type);
    });

    // ⚡ Escuchador Reactivo: Si seleccionan un cliente, parchamos sus datos fiscales automáticamente
    this.invoiceForm.get('customerId')?.valueChanges.subscribe((id) => {
      if (!id) return;
      const customer = this.customersList.find((c) => c.id === Number(id));
      if (customer) {
        this.invoiceForm.patchValue({
          // 🎯 DIRECTO Y LIMPIO: Sin malabares, hereda el código exacto de la BD
          customerIdentityType: customer.documentType,
          customerIdentityNumber: customer.documentNumber || '',
          customerName: customer.name || '',
          customerAddress: customer.address || 'DIRECCIÓN FISCAL NO REGISTRADA',
        });
        this.cdr.detectChanges();
      }
    });
  }

  private initForm(): void {
    this.invoiceForm = this.fb.group({
      documentType: ['FACTURA', [Validators.required]],
      seriesId: ['', [Validators.required]],
      customerId: ['', [Validators.required]],
      customerIdentityType: ['', [Validators.required]],
      customerIdentityNumber: ['', [Validators.required]],
      customerName: ['', [Validators.required]],
      customerAddress: [''],
      currencyCode: ['PEN', [Validators.required]],
      exchangeRate: [1.0, [Validators.required, Validators.min(0.0001)]],
      totalLetras: ['', [Validators.required]],
      details: this.fb.array([]), // Carrito de compras matricial
    });
  }

  get detailsFormArray(): FormArray {
    return this.invoiceForm.get('details') as FormArray;
  }

  // 🛰️ CARGA EN PARALELO DE DIRECTORIÓS DESDE MYSQL
  loadFormCatalogs(): void {
    this.isLoading = true;

    const EXCHANGES_API = `${environment.apiUrl}/exchanges/today`;
    const PARAM_BASE = `${environment.apiUrl}/products/parameters`;
    const IDENTITY_TYPES_API = `${PARAM_BASE}?type=TIPO_DOCUMENTO_IDENTIDAD`;
    const DOCUMENT_TYPES_API = `${PARAM_BASE}?type=TIPO_COMPROBANTE`; // O el nombre que uses en BD
    const CURRENCIES_API = `${PARAM_BASE}?type=MONEDA`;
    const TAX_TYPES_API = `${PARAM_BASE}?type=TIPO_AFECTACION_IGV`;

    combineLatest([
      this.http.get<{ data: any }>(`${this.SERIES_API}?limit=100`),
      this.http.get<{ data: any }>(`${this.ENTITIES_API}?limit=100`),
      this.http.get<{ data: any }>(`${this.PRODUCTS_API}?limit=100`),
      this.http.get<{ data: any }>(EXCHANGES_API),
      this.http.get<{ data: any }>(IDENTITY_TYPES_API),
      this.http.get<{ data: any }>(DOCUMENT_TYPES_API),
      this.http.get<{ data: any }>(CURRENCIES_API),
      this.http.get<{ data: any }>(TAX_TYPES_API),
    ]).subscribe({
      next: ([
        seriesRes,
        entitiesRes,
        productsRes,
        exchangeRes,
        identityTypesRes,
        docTypesRes,
        currenciesRes,
        taxTypesRes,
      ]) => {
        const seriesWrapper = seriesRes?.data || seriesRes;
        this.seriesList = seriesWrapper?.data || [];

        const entitiesWrapper = entitiesRes?.data || entitiesRes;
        this.customersList = entitiesWrapper?.data || [];

        const productsWrapper = productsRes?.data || productsRes;
        this.productsList = productsWrapper?.data || [];

        const identityWrapper = identityTypesRes?.data || identityTypesRes;
        this.identityTypesList = identityWrapper?.data || identityWrapper || [];

        // 🌟 2. Tipos de Comprobante (Factura/Boleta)
        this.documentTypesList = docTypesRes?.data || docTypesRes || [];
        // Si la tabla de comprobantes está vacía por ahora, creamos un fallback para que no quede en blanco
        if (this.documentTypesList.length === 0) {
          this.documentTypesList = [
            { code: 'FACTURA', name: 'Factura Electrónica' },
            { code: 'BOLETA', name: 'Boleta de Venta' },
            { code: 'NOTA_PEDIDO', name: 'Nota de Pedido' },
          ];
        }

        //🌟 3. Monedas (PEN/USD)
        this.currenciesList = currenciesRes?.data || currenciesRes || [];

        // 🌟 4. Afectaciones al IGV (Gravado/Exonerado/Inafecto)
        this.taxTypesList = taxTypesRes?.data || taxTypesRes || [];

        this.customersList = entitiesRes?.data || [];

        console.log(
          '🕵️‍♂️ RADAR POST-LOAD: Clientes rescatados con éxito:',
          this.customersList.length,
        );
        // Inicializamos la lista filtrada con todo el catálogo real
        this.filteredCustomers = [...this.customersList];
        // 🌟 CORRECCIÓN PUNTO 1: Inicializamos la lista filtrada con todo el catálogo al nacer
        //this.filteredCustomers = [...this.customersList];

        // 🌟 CORRECCIÓN PUNTO 2: Forzamos la creación del formulario del modal express en la RAM
        this.initCustomerExpressForm();

        const rawCurrencies = exchangeRes?.data || exchangeRes;
        this.todayExchangeRateValue = Number(rawCurrencies?.sellPrice || 3.75);

        this.filterSeriesByDocType('FACTURA'); // Inicializa con Facturas
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error al cargar catálogos logísticos:', err);
        this.todayExchangeRateValue = 3.75;
        this.filteredCustomers = [...this.customersList];
        this.initCustomerExpressForm(); // Respaldo preventivo
        this.filterSeriesByDocType('FACTURA');
        this.cdr.detectChanges();
      },
    });
  }

  onCurrencyChange(currencyCode: string): void {
    const rateInput = this.invoiceForm.get('exchangeRate');

    if (currencyCode === 'PEN') {
      // 🇵🇪 Moneda Nacional: La paridad contable es estrictamente la unidad
      rateInput?.setValue(1.0);
    } else if (currencyCode === 'USD') {
      // 💵 Moneda Extranjera Dólar: Inyecta el valor dinámico recuperado de tu tabla de cambios
      rateInput?.setValue(this.todayExchangeRateValue);
    } else if (currencyCode === 'EUR') {
      // 💶 Moneda Extranjera Euro: Aplicamos un factor de conversión contable referencial o
      // puedes jalar otra variable. Por ahora le clavamos un fallback realista (Ej: 4.0500)
      // o puedes mapear una variable todayEuroExchangeRateValue si la creas en tu combineLatest.
      const rawEuroRate = this.todayExchangeRateValue * 1.08; // Factor cruzado aproximado internacional (Dólar x 1.08)
      rateInput?.setValue(Number(rawEuroRate.toFixed(4)));
    }

    // Gatilla de inmediato el recálculo aritmético del total del carrito de compras
    this.calculateInvoiceTotals();
  }

  filterSeriesByDocType(type: string): void {
    this.filteredSeries = this.seriesList.filter(
      (s) => s.documentType === type,
    );
    if (this.filteredSeries.length > 0) {
      this.invoiceForm.patchValue({ seriesId: this.filteredSeries[0].id });
    } else {
      this.invoiceForm.patchValue({ seriesId: '' });
    }
    this.cdr.detectChanges();
  }

  // =========================================================================
  // 🛒 LÓGICA DEL CARRITO DE COMPRAS MATRICIAL (FormArray)
  // =========================================================================
  addDetailRow(product?: any): void {
    const row = this.fb.group({
      productId: [product ? product.id : '', [Validators.required]],
      productCode: [product ? product.productCode : '', [Validators.required]],
      productName: [product ? product.name : '', [Validators.required]],
      unitMeasureCode: [product?.unitMeasureParamId === 4 ? 'ZZ' : 'NIU'], // Paramétrica aproximada SUNAT
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitPrice: [
        product ? Number(product.salesPrice) : 0,
        [Validators.required, Validators.min(0.01)],
      ],
      taxTypeCode: ['10'], // Por defecto Gravado (18%)
    });

    // Escuchador interno por fila: Si cambia cantidad o precio, recalculamos matemáticas globales
    row.valueChanges.subscribe(() => this.calculateInvoiceTotals());

    this.detailsFormArray.push(row);
    this.calculateInvoiceTotals();
  }

  removeDetailRow(index: number): void {
    this.detailsFormArray.removeAt(index);
    this.calculateInvoiceTotals();
  }

  onProductSelectChange(index: number, productId: any): void {
    const prod = this.productsList.find((p) => p.id === Number(productId));
    if (prod) {
      const row = this.detailsFormArray.at(index);
      row.patchValue(
        {
          productCode: prod.productCode,
          productName: prod.name,
          unitPrice: Number(prod.salesPrice),
        },
        { emitEvent: true },
      );
    }
  }

  // =========================================================================
  // 📊 MATRIZ MATEMÁTICA DE DESGLOSE DE IMPUESTOS GLOBAL
  // =========================================================================
  calculateInvoiceTotals(): void {
    let gravada = 0;
    let exonerada = 0;
    let inafecta = 0;
    let igv = 0;
    let total = 0;

    this.detailsFormArray.controls.forEach((control) => {
      const values = control.value;
      const qty = Number(values.quantity || 0);
      const price = Number(values.unitPrice || 0);
      const subtotalRowPrice = qty * price;

      if (values.taxTypeCode === '10') {
        // Gravada
        const valueWithoutIgv = price / 1.18;
        const subtotalRowValue = valueWithoutIgv * qty;
        const rowIgv = subtotalRowPrice - subtotalRowValue;

        gravada += subtotalRowValue;
        igv += rowIgv;
        total += subtotalRowPrice;
      } else if (values.taxTypeCode === '20') {
        // Exonerado
        exonerada += subtotalRowPrice;
        total += subtotalRowPrice;
      } else {
        // Inafecto
        inafecta += subtotalRowPrice;
        total += subtotalRowPrice;
      }
    });

    this.totalGravada = gravada;
    this.totalExonerada = exonerada;
    this.totalInafecta = inafecta;
    this.totalIgv = igv;
    this.totalVenta = total;

    // Convertimos las monedas a texto legal
    const glosaLetras = this.convertirNumeroALetras(
      total,
      this.invoiceForm.get('currencyCode')?.value,
    );
    this.invoiceForm
      .get('totalLetras')
      ?.setValue(glosaLetras, { emitEvent: false });
    this.cdr.detectChanges();
  }

  // =========================================================================
  // 💾 GRABADO TRANSACCIONAL EN MYSQL
  // =========================================================================
  onSubmitInvoice(): void {
    if (this.invoiceForm.invalid) {
      this.invoiceForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.formErrorMessage = null;

    this.http.post(this.API_URL, this.invoiceForm.value).subscribe({
      next: (res: any) => {
        // this.isLoading = false;
        // alert(res?.message || 'Comprobante emitido con éxito.');
        // this.router.navigate(['/principal/invoices/invoice-list']); // Volvemos al historial

        this.isLoading = false;

        const invoiceResult = res?.data || res;

        // 1. 🚀 CONFIGURAMOS EL RADAR DEL TOAST PREMIUM
        this.successToastMessage =
          res?.message || 'Comprobante emitido con éxito.';
        this.successInvoiceNumber =
          invoiceResult.fullDocumentNumber || 'N° Generado';
        this.successInvoiceTotal = Number(invoiceResult.totalVenta || 0);

        // 2. Encendemos el interruptor visual en la RAM
        this.showSuccessToast = true;
        this.cdr.detectChanges();

        // Si el Toast de éxito se ha pintado, obligamos al navegador a subir suave y elegantemente
        if (this.successToastElement) {
          this.successToastElement.nativeElement.scrollIntoView({
            behavior: 'smooth', // Desplazamiento animado y limpio
            block: 'start', // Posiciona la parte superior de la pantalla a esta altura
          });
        }

        // 3. Limpiamos por completo el carrito de compras del POS para la siguiente venta
        this.clearInvoiceFormAndCart();

        // 4. ⏳ TEMPORIZADOR AUTOMÁTICO: Después de 4 segundos, el cartel se apaga solo
        setTimeout(() => {
          this.showSuccessToast = false;
          this.cdr.detectChanges();
        }, 4000);
      },
      error: (err) => {
        this.isLoading = false;
        this.formErrorMessage =
          err?.error?.message || 'Error crítico al emitir la venta.';
        this.cdr.detectChanges();

        if (this.errorBanner) {
          this.errorBanner.nativeElement.scrollIntoView({
            behavior: 'smooth', // Desplazamiento animado y elegante, no un salto brusco
            block: 'center', // Centra el cartel perfectamente en el monitor del cajero
          });
        }
      },
    });
  }

  clearInvoiceFormAndCart(): void {
    console.log(
      '🧹 RADAR POS - Limpiando carrito de compras y reseteando variables contables...',
    );

    // 1. Vaciamos por completo el arreglo en RAM que sostiene los productos del carrito
    // Reemplaza 'cartItems' por el nombre exacto de tu variable del array del carrito
    if (this.detailsFormArray) {
      this.detailsFormArray.clear();
    }

    // 2. Reseteamos el FormGroup principal a sus condiciones iniciales de fábrica
    this.invoiceForm.reset({
      seriesId: '', // Limpia la serie para obligar a seleccionar o re-filtrar
      dueDate: null,
      customerId: '', // Remueve al cliente de la venta anterior
      customerIdentityType: '',
      customerIdentityNumber: '',
      customerName: '',
      customerAddress: '',
      currencyCode: 'PEN', // Vuelve por defecto a la moneda nacional Soles
      exchangeRate: 1.0, // Tipo de cambio plano base
      totalLetras: '',
    });

    // 3. Si manejas campos o alertas de error pegados, los pulverizamos aquí
    this.formErrorMessage = null;

    // 4. Forzamos a Angular a redibujar toda la pantalla del POS en limpio inmediatamente
    this.cdr.detectChanges();
  }
  cancelForm(): void {
    this.router.navigate(['/principal/invoices/invoice-list']);
  }

  // =========================================================================
  // 🗒️ CONVERSOR DE NÚMEROS A LETRAS TEXTUALES SINCRO SUNAT
  // =========================================================================
  private convertirNumeroALetras(monto: number, moneda: string): string {
    if (monto === 0) return 'SON CERO CON 00/100 SOLES';

    const centavos = Math.round((monto % 1) * 100);
    const entero = Math.floor(monto);
    const sufijoMoneda = moneda === 'USD' ? 'DÓLARES AMERICANOS' : 'SOLES';
    const strCentavos = String(centavos).padStart(2, '0');

    // Mapeo simple estático para demostración en caliente de enteros bajos
    let textoEntero = 'UN';
    if (entero === 1) textoEntero = 'UNO';
    else if (entero > 1) textoEntero = String(entero); // Para un algoritmo extenso de producción usaremos un helper, por ahora pinta el número

    return `SON ${textoEntero} CON ${strCentavos}/100 ${sufijoMoneda}`;
  }
}
