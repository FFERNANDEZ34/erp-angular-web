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

  databaseDollarSaleRate = 3.75;
  databaseEuroSaleRate = 4.6;

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
  isSearchingPadron = false;

// 🌟 VARIABLES DE TESORERÍA MODAL (ESTÁNDAR ODOO)
  showPaymentModal = false;
  generatedInvoiceId: number | null = null;
  generatedInvoiceNumber = '';
  generatedInvoiceTotal = 0;

  // Variables dinámicas del formulario de cobro
  selectedPaymentMethod: 'EFECTIVO' | 'TARJETA_POS' | 'TRANSFERENCIA' | 'YAPE_PLIN' = 'EFECTIVO';
  cashAmountReceived = 0; // Con cuánto paga (Efectivo)
  cashChangeCalculated = 0; // Vuelto automático
  posTransactionNumber = ''; // Nro operación tarjeta/Yape
  selectedEvidenceFile: File | null = null; // Archivo de voucher adjunto
  isSavingPayment = false; 


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

  searchDocumentInNationalPadron(): void {
    const docType = this.customerExpressForm.get('documentType')?.value;
    const docNumber = this.customerExpressForm.get('documentNumber')?.value;

    if (!docType || !docNumber) {
      this.formErrorMessage = '⚠️ Por favor, seleccione el Tipo de documento e ingrese el número primero.';
      return;
    }

    // Validaciones preventivas de longitud de caracteres
    if (docType === '1' && docNumber.length !== 8) {
      this.formErrorMessage = '⚠️ El DNI debe contener exactamente 8 números.';
      return;
    }
    if (docType === '6' && docNumber.length !== 11) {
      this.formErrorMessage = '⚠️ El RUC comercial debe contener exactamente 11 números.';
      return;
    }

    this.isSearchingPadron = true;
    this.formErrorMessage = null;
    this.cdr.detectChanges();

    // 🚀 DISPARO AL ENDPOINT DE TU API
    this.http.get(`${environment.apiUrl}/entities/padron/${docType}/${docNumber}`).subscribe({
      next: (res: any) => {
        this.isSearchingPadron = false;
        const result = res?.data || res;

        if (result && result.name) {
          // 🎯 EL AUTOCOMPLETADO MAGICO: Parcheamos las cajas de Razón Social y Dirección en un milisegundo
          this.customerExpressForm.patchValue({
            name: result.name.toUpperCase(),
            address: result.address ? result.address.toUpperCase() : 'DIRECCIÓN FISCAL NO ESPECIFICADA'
          });
          
          alert(`¡Documento verificado con éxito en la matriz nacional!`);
        } else {
          this.formErrorMessage = '⚠️ El documento no devolvió ninguna Razón Social válida.';
        }
        
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSearchingPadron = false;
        // Si el RUC no existe o la SUNAT está caída, capturamos el mensaje amigable
        this.formErrorMessage = err?.error?.message || '⚠️ No se pudo conectar con el Padrón Nacional en este instante.';
        
        // Ejecutamos el scroll suave que programamos antes para enfocar la alerta
        if (this.errorBanner) {
          this.errorBanner.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        this.cdr.detectChanges();
      }
    });
  }
  
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

    this.setupMultimonedaListeners();
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

      // 💵 TUS DOS CONTROLES DE TIPOS DE CAMBIO EN VIVO SINCRO
      exchangeRate: [1.0, [Validators.required, Validators.min(0.0001)]],
      exchangeRateEuro: [4.15, [Validators.required, Validators.min(0.0001)]], // 🚀 ¡INYECTADO AQUÍ!: Nace con un valor comercial prudente

      totalLetras: ['', [Validators.required]],
      details: this.fb.array([]), // Carrito de compras matricial (detailsFormArray)
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
    const DOCUMENT_TYPES_API = `${PARAM_BASE}?type=TIPO_COMPROBANTE`;
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

        // 🌟 Tipos de Comprobante (Factura/Boleta)
        this.documentTypesList = docTypesRes?.data || docTypesRes || [];
        if (this.documentTypesList.length === 0) {
          this.documentTypesList = [
            { code: 'FACTURA', name: 'Factura Electrónica' },
            { code: 'BOLETA', name: 'Boleta de Venta' },
            { code: 'NOTA_PEDIDO', name: 'Nota de Pedido' },
          ];
        }

        // 🌟 Monedas (PEN/USD/EUR)
        this.currenciesList = currenciesRes?.data || currenciesRes || [];

        // 🌟 Afectaciones al IGV (Gravado/Exonerado/Inafecto)
        this.taxTypesList = taxTypesRes?.data || taxTypesRes || [];

        this.customersList = entitiesRes?.data || [];

        console.log(
          '🕵️‍♂️ RADAR POST-LOAD: Clientes rescatados con éxito:',
          this.customersList.length,
        );

        this.filteredCustomers = [...this.customersList];
        this.initCustomerExpressForm();

        // =========================================================================
        // 🎰 MOTOR DE EXTRACCIÓN CAMBIARIA CONEXIÓN MYSQL (CORREGIDO)
        // =========================================================================
        const rawCurrencies = exchangeRes?.data || exchangeRes;
        console.log(
          '🕵️‍♂️ RADAR EXCHANGES - Payload recibido del backend:',
          rawCurrencies,
        );

        // 🛡️ Captura el valor del DÓLAR. Mapea la columna de tu API (ej: sellPrice, usd_venta, etc.)
        this.databaseDollarSaleRate = Number(
          rawCurrencies?.sellPrice || rawCurrencies?.usd_venta || 3,
        );

        // 🛡️ Captura el valor del EURO. Revisa cómo viaja la clave en tu JSON (ej: euroSellPrice, eur_venta, etc.)
        // Reemplaza 'euroSellPrice' o 'eur_venta' por el nombre literal que use tu API de tipo de cambio
        this.databaseEuroSaleRate = Number(
          rawCurrencies?.euroSellPrice || rawCurrencies?.eur_venta || 4,
        );

        console.log(
          `🎰 MATRIZ ASIGNADA -> Dólar Real: [${this.databaseDollarSaleRate}] | Euro Real: [${this.databaseEuroSaleRate}]`,
        );

        // Seteamos los acumuladores base globales
        this.todayExchangeRateValue = this.databaseDollarSaleRate;

        const inicialCurrency =
          this.invoiceForm.get('currencyCode')?.value || 'PEN';

        // 🎯 AUTOPARCHEO REACTIVO TOTAL: Inyectamos los valores reales de la BD a las cajas de texto del POS
        this.invoiceForm.patchValue(
          {
            exchangeRate:
              inicialCurrency === 'PEN' ? 1.0 : this.databaseDollarSaleRate,
            exchangeRateEuro: this.databaseEuroSaleRate,
          },
          { emitEvent: false },
        ); // Evitamos disparos en cascada innecesarios en la carga inicial
        // =========================================================================

        this.filterSeriesByDocType('FACTURA');
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error al cargar catálogos logísticos:', err);
        this.databaseDollarSaleRate = 3.75;
        this.databaseEuroSaleRate = 4.6;
        this.todayExchangeRateValue = 3.75;
        this.filteredCustomers = [...this.customersList];
        this.initCustomerExpressForm();

        this.invoiceForm.patchValue({
          exchangeRate: this.databaseDollarSaleRate,
          exchangeRateEuro: this.databaseEuroSaleRate,
        });

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
    // Si nace vacío (botón "Añadir Ítem"), los valores por defecto serán en Soles ('PEN') y cero
    const productCurrency = product?.Currency?.code || 'PEN';
    const originalPrice = product ? Number(product.salesPrice) : 0;

    const row = this.fb.group({
      productId: [product ? product.id : '', [Validators.required]],
      productCode: [product ? product.productCode : '', [Validators.required]],
      productName: [product ? product.name : '', [Validators.required]],
      unitMeasureCode: [product ? 'NIU' : 'NIU'],
      quantity: [1, [Validators.required, Validators.min(1)]],

      // 🌟 ANCLAS REGISTRADAS: Garantizan que la fila tenga espacio para guardar el origen al cambiar el select
      productOriginalCurrency: [productCurrency],
      productOriginalPrice: [originalPrice],

      unitPrice: [
        product
          ? this.calculateConvertedPrice(originalPrice, productCurrency)
          : 0,
        [Validators.required, Validators.min(0.01)],
      ],
      taxTypeCode: ['10'],
    });

    row.valueChanges.subscribe(() => this.calculateInvoiceTotals());
    this.detailsFormArray.push(row);
    this.calculateInvoiceTotals();
  }

  calculateConvertedPrice(
    originalPrice: number,
    productCurrency: string,
  ): number {
    const invoiceCurrency = String(
      this.invoiceForm.get('currencyCode')?.value || 'PEN',
    )
      .trim()
      .toUpperCase();
    const prodCurrency = String(productCurrency).trim().toUpperCase();

    // Si las monedas coinciden de forma nativa, pasa limpio sin procesamiento
    if (prodCurrency === invoiceCurrency) {
      return originalPrice;
    }

    // Recuperamos nuestra matriz de tipos de cambio del milisegundo actual
    const rates = this.getExchangeRatesMatrix();
    const rateOrigen = rates[prodCurrency] || 1.0;
    const rateDestino = rates[invoiceCurrency] || 1.0;

    // 🔄 FASE 1: PASAMOS LA MONEDA ORIGEN DEL PRODUCTO A SOLES (PEN) PIVOTE
    // Ejemplo: Mouse Logitech de 450 EUR -> 450 * 4.10 = S/ 1845.00 Soles puros
    const priceInSolesPivote = originalPrice * rateOrigen;

    // 🔄 FASE 2: PASAMOS LOS SOLES PIVOTE A LA MONEDA DESTINO DEL COMPROBANTE
    // Ejemplo: Si el POS cambió a USD -> S/ 1845.00 / 3.80 (TC Dólar) = \$ 485.5263
    const finalPriceConverted = priceInSolesPivote / rateDestino;

    console.log(
      `🧮 [PIVOTE SINCRO] ${prodCurrency} ${originalPrice} ➔ PEN ${priceInSolesPivote.toFixed(2)} ➔ CONVERTIDO FINAL: ${invoiceCurrency} ${finalPriceConverted.toFixed(2)}`,
    );

    return Number(finalPriceConverted.toFixed(2));
  }

  getExchangeRatesMatrix(): { [key: string]: number } {
    const dollarRate = Number(
      this.invoiceForm.get('exchangeRate')?.value || 3.75,
    );
    const euroRate = Number(
      this.invoiceForm.get('exchangeRateEuro')?.value || 4.15,
    );

    return {
      PEN: 1.0,
      USD: dollarRate,
      EUR: euroRate, // Puedes amarrarlo a otro input o dejar este fallback comercial estándar
    };
  }

  // 🔄 B. RECALCULADOR MASIVO DEL CARRITO (Se ejecuta al cambiar los combos de la cabecera)
  updateAllCartPricesByExchangeRate(): void {
    if (!this.detailsFormArray || this.detailsFormArray.length === 0) return;

    // Recuperamos las variables maestras de la cabecera en este instante
    const currentInvoiceCurrency =
      this.invoiceForm.get('currencyCode')?.value || 'PEN';
    const currentRate = Number(
      this.invoiceForm.get('exchangeRate')?.value || 1.0,
    );

    console.log(
      '================ 🕵️‍♂️ RADAR MULTIMONEDA: CABECERA MUTADA ================',
    );
    console.log(
      `Procesando conversión masiva para ${this.detailsFormArray.length} ítems a Moneda: [${currentInvoiceCurrency}] con TC: [${currentRate}]`,
    );

    // Recorremos fila por fila el FormArray actualizando los precios unitarios
    this.detailsFormArray.controls.forEach((row, index) => {
      const originalPrice = Number(row.get('productOriginalPrice')?.value || 0);
      const productCurrency =
        row.get('productOriginalCurrency')?.value || 'PEN';

      // Calculamos el precio correspondiente al milisegundo actual
      const newUnitPrice = this.calculateConvertedPrice(
        originalPrice,
        productCurrency,
      );

      console.log(
        `➔ Fila [${index}] | Original: [${productCurrency} ${originalPrice}] -> Convertido al POS: [${currentInvoiceCurrency} ${newUnitPrice}]`,
      );

      // 🎯 EL DESTRABE REACITVO: Removemos { emitEvent: false }.
      // Esto obliga a la caja de texto del HTML a enterarse del cambio y redibujar el número en tu pantalla.
      row.get('unitPrice')?.setValue(newUnitPrice);
    });

    // Recalculamos la matemática de Gravada, IGV y Total global de la venta
    this.calculateInvoiceTotals();
    this.cdr.detectChanges(); // Fuerza el refresco visual absoluto en tu monitor
    console.log(
      '========================================================================',
    );
  }

  // 🛰️ C. ESCUCHADORES DE CABECERA (Inyéctalos dentro de tu ngOnInit)
  setupMultimonedaListeners(): void {
    console.log(
      '🚀 RADAR - Inicializando escuchadores transaccionales multimoneda blindados...',
    );

    // 1. Combo de Moneda Principal
    this.invoiceForm
      .get('currencyCode')
      ?.valueChanges.subscribe((monedaCode) => {
        const codeStr = String(monedaCode).trim().toUpperCase();

        console.log(
          `📡 Combo Moneda mutó en caliente a: [${codeStr}] -> Autoparchando tasas de MySQL...`,
        );

        if (codeStr === 'PEN') {
          this.invoiceForm.patchValue(
            {
              exchangeRate: 1.0,
              exchangeRateEuro: this.databaseEuroSaleRate,
            },
            { emitEvent: false },
          );
        } else if (codeStr === 'USD') {
          this.invoiceForm.patchValue(
            {
              exchangeRate: this.databaseDollarSaleRate,
              exchangeRateEuro: this.databaseEuroSaleRate,
            },
            { emitEvent: false },
          );
        } else if (codeStr === 'EUR') {
          this.invoiceForm.patchValue(
            {
              exchangeRate: this.databaseEuroSaleRate, // 🎯 FORZAMOS 4.60 EN EL CAMPO DEL DÓLAR COMO PIVOTE CONTRA SCRIPTS EXTERNOS
              exchangeRateEuro: this.databaseEuroSaleRate,
            },
            { emitEvent: false },
          );
        }

        this.updateAllCartPricesByExchangeRate();
      });

    // 2. Input de Tipo de Cambio Dólar (Equipado con Cortafuegos preventivo)
    this.invoiceForm.get('exchangeRate')?.valueChanges.subscribe((tcDolar) => {
      const currentCurrency = this.invoiceForm.get('currencyCode')?.value;

      // 🛡️ EL CORTAFUEGOS ATÓMICO: Si el comprobante está en EUR, ignoramos cualquier intento
      // del HTML o extensiones por clavar un 4.0824 en la caja del dólar
      if (
        currentCurrency === 'EUR' &&
        Number(tcDolar) !== this.databaseEuroSaleRate
      ) {
        console.warn(
          `🛑 RADAR INTERCEPTOR - Bloqueando tasa fantasma [${tcDolar}] en modo EUR.`,
        );
        this.invoiceForm
          .get('exchangeRate')
          ?.setValue(this.databaseEuroSaleRate, { emitEvent: false });
        return;
      }

      console.log(
        `📡 Input T.C. Dólar cambió manualmente a: [${tcDolar}] -> Recalculando...`,
      );
      this.updateAllCartPricesByExchangeRate();
    });

    // 3. Input de Tipo de Cambio Euro
    this.invoiceForm
      .get('exchangeRateEuro')
      ?.valueChanges.subscribe((tcEuro) => {
        console.log(
          `📡 Input T.C. Euro cambió manualmente a: [${tcEuro}] -> Recalculando...`,
        );
        this.updateAllCartPricesByExchangeRate();
      });
  }

  removeDetailRow(index: number): void {
    this.detailsFormArray.removeAt(index);
    this.calculateInvoiceTotals();
  }

  onProductSelectChange(index: number, productIdStr: string): void {
    console.log(
      '================ 🕵️‍♂️ RADAR CRÍTICO SELECT: DISPARADO ================',
    );
    console.log(
      `Fila afectada: [${index}] | ID de Producto recibido: [${productIdStr}]`,
    );

    if (!productIdStr) return;

    const productId = Number(productIdStr);
    const selectedProduct = this.productsList.find((p) => p.id === productId);

    if (!selectedProduct) {
      console.warn(
        '❌ ERROR: El producto seleccionado no existe en la lista productsList de la RAM.',
      );
      return;
    }

    // Capturamos la moneda original de tu base de datos (Ej: 'EUR')
    // Usamos un fallback inteligente si tus variables se llaman diferente
    const productCurrency =
      selectedProduct.Currency?.code || selectedProduct.currencyCode || 'EUR';
    const originalPrice = Number(selectedProduct.salesPrice || 0);

    console.log(
      `Artículo Encontrado: ${selectedProduct.name} | Moneda Origen: [${productCurrency}] | Precio Base: [${originalPrice}]`,
    );

    const rowGroup = this.detailsFormArray.at(index);
    if (!rowGroup) {
      console.warn(
        `❌ ERROR: No se encontró la fila reactiva en el índice [${index}] del FormArray.`,
      );
      return;
    }

    // 🧮 CALCULO FINANCIERO INICIAL
    const finalConvertedPrice = this.calculateConvertedPrice(
      originalPrice,
      productCurrency,
    );
    console.log(`➔ Resultado del motor de conversión: ${finalConvertedPrice}`);

    // Parcheamos el FormGroup de la fila inyectando los valores y forzando la actualización
    rowGroup.patchValue({
      productCode: selectedProduct.productCode || '',
      productName: selectedProduct.name || '',
      unitMeasureCode: selectedProduct.unitMeasureParamId === 4 ? 'ZZ' : 'NIU',

      // Sello inmutable de nacimiento
      productOriginalCurrency: productCurrency,
      productOriginalPrice: originalPrice,

      // Inyectamos el precio en la caja de texto
      unitPrice: finalConvertedPrice,
    });

    this.calculateInvoiceTotals();
    this.cdr.detectChanges(); // Fuerza a Angular a pintar el cambio en tu monitor
    console.log(
      '========================================================================',
    );
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

    // 🔒 CONGELAMOS EL BOTÓN: Inhabilitamos doble click para evitar duplicar facturas
    this.isLoading = true;
    this.formErrorMessage = null;

    this.http.post(this.API_URL, this.invoiceForm.value).subscribe({
      next: (res: any) => {
        const invoiceResult = res?.data || res;

        // 1. 🎯 CAPTURAMOS LA IDENTIDAD TRANSACCIONAL DEL COMPROBANTE EMITIDO
        this.generatedInvoiceId = invoiceResult.id;
        this.generatedInvoiceNumber = invoiceResult.fullDocumentNumber || 'N° Generado';
        
        // Extraemos el total venta calculado por el backend o el de tu acumulador de la UI
        this.generatedInvoiceTotal = Number(invoiceResult.totalVenta || this.invoiceForm.get('totalVenta')?.value || 0);

        // 2. 🧮 PRE-CONFIGURAMOS LAS MATRICES DE EFECTIVO PARA EL CAJERO
        // Nace cargando el total exacto de la venta para agilizar el vuelto (vuelto nacerá en 0.00)
        this.cashAmountReceived = this.generatedInvoiceTotal;
        this.cashChangeCalculated = 0;
        this.posTransactionNumber = '';
        this.selectedEvidenceFile = null;
        this.selectedPaymentMethod = 'EFECTIVO'; // Nace en efectivo por defecto comercial

        // 3. 🚀 DISPARAMOS EL MODAL FINANCIERO DE COBRO (Estilo Odoo)
        // La pantalla del POS se queda intacta atrás, bloqueada y congelada
        this.showPaymentModal = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        // Si la base de datos rebota la factura (ej: stock insuficiente), liberamos el botón
        this.isLoading = false;
        this.formErrorMessage = err?.error?.message || 'Error crítico al emitir la venta.';
        this.cdr.detectChanges();

        if (this.errorBanner) {
          this.errorBanner.nativeElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
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
    const codeStr = String(moneda).trim().toUpperCase();

    // 🎯 DICCIONARIO DE LEYENDAS LEGALES EXIGIDAS POR SUNAT (Inmune a ruidos)
    const labelDictionary: { [key: string]: string } = {
      PEN: 'SOLES',
      USD: 'DÓLARES AMERICANOS',
      EUR: 'EUROS',
    };

    const sufijoMoneda = labelDictionary[codeStr] || codeStr;

    if (monto === 0) return `SON CERO CON 00/100 ${sufijoMoneda}`;

    const centavos = Math.round((monto % 1) * 100);
    const entero = Math.floor(monto);
    const strCentavos = String(centavos).padStart(2, '0');

    // Mapeo simple estático para demostración en caliente de enteros bajos
    let textoEntero = 'UN';
    if (entero === 1) textoEntero = 'UNO';
    else if (entero > 1) textoEntero = String(entero);

    return `SON ${textoEntero} CON ${strCentavos}/100 ${sufijoMoneda}`;
  }

  //Todo: Esto es para realizar los pagos
  // 💵 A. CALCULADOR DE VUELTO EN VIVO
  calculateChange(): void {
    if (this.selectedPaymentMethod === 'EFECTIVO') {
      const received = Number(this.cashAmountReceived || 0);
      const total = this.generatedInvoiceTotal;
      this.cashChangeCalculated = received > total ? Number((received - total).toFixed(2)) : 0;
    } else {
      this.cashChangeCalculated = 0;
    }
    this.cdr.detectChanges();
  }

  // 📸 B. CAPTURADOR DEL ARCHIVO VOUCHER (INPUT FILE)
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedEvidenceFile = file;
      console.log('📸 Voucher capturado en RAM listo para subir:', file.name);
    }
  }

  // 🏁 C. DESPACHADOR DE TESORERÍA COMPUESTO (MÉTODO MULTIPART/FORM-DATA)
  onConsolidatePayment(): void {
  if (!this.generatedInvoiceId) return;

  // 🎯 DESTRABE ATÓMICO: Encendemos el loader propio de la pasarela de cobros
  this.isSavingPayment = true; 
  this.cdr.detectChanges();

  const formData = new FormData();
  formData.append('invoiceHeaderId', String(this.generatedInvoiceId));

  const paymentsPayload = [{
    paymentMethod: this.selectedPaymentMethod,
    amountPaid: this.generatedInvoiceTotal, 
    amountReceived: this.selectedPaymentMethod === 'EFECTIVO' ? this.cashAmountReceived : this.generatedInvoiceTotal,
    cashChange: this.cashChangeCalculated,
    transactionNumber: this.posTransactionNumber || null
  }];

  formData.append('payments', JSON.stringify(paymentsPayload));

  if (this.selectedEvidenceFile) {
    formData.append('evidenceFile', this.selectedEvidenceFile, this.selectedEvidenceFile.name);
  }

  this.http.post(`${environment.apiUrl}/payments`, formData).subscribe({
    next: (res: any) => {
      this.showPaymentModal = false;
      this.showSuccessToast = true;
      this.successToastMessage = 'Cobro y cuadre de caja consolidado con éxito.';

      // 🧹 Apagamos ambos interruptores y limpiamos el POS para la siguiente venta de la cola
      this.isSavingPayment = false;
      this.isLoading = false; // Libera también el formulario base de atrás
      this.clearInvoiceFormAndCart(); 
      
      this.cdr.detectChanges();
      
      setTimeout(() => {
        this.showSuccessToast = false;
        this.cdr.detectChanges();
      }, 4000);
    },
    error: (err) => {
      // Si el banco o la API rebotan el cobro, liberamos el botón verde para intentar de nuevo
      this.isSavingPayment = false;
      alert(err?.error?.message || 'Error en el procesamiento del cuadre de caja.');
      this.cdr.detectChanges();
    }
  });
}

  // Botón manual de Odoo por si decide dejar la factura al crédito e irse sin cobrar
  onCloseManualWithoutPaying(): void {
    this.showPaymentModal = false;
    this.isLoading = false;
    this.clearInvoiceFormAndCart(); // Limpia la pantalla para la siguiente venta de la cola
    this.cdr.detectChanges();
  }
}
