import { Injectable } from '@angular/core';
import * as QRCode from 'qrcode'; // 🎯 1. Importación criptográfica local indispensable

@Injectable({ providedIn: 'root' })
export class TicketPrinterService {
  
  /**
   * 🔥 DISPARO EN CALIENTE: Genera un iframe invisible y manda la orden a la ticketera de 80mm con QR en Base64
   */
  public async printThermalTicket(invoice: any): Promise<void> { // 🎯 2. Mutamos a función async
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    
    document.body.appendChild(iframe);

    const itemsHtml = invoice.Details?.map((item: any) => `
      <tr>
        <td align="left">
          ${item.productName || item.productCode}
          <br>
          <small style="font-size: 10px;">P.U: ${(Number(item.unitPrice)).toFixed(2)}</small>
        </td>
        <td align="center">${Number(item.quantity)}</td>
        <td align="right">${(Number(item.subtotalPrice)).toFixed(2)}</td>
      </tr>
    `).join('') || '';

    // =========================================================================
    // 🎯 CONSTRUCCIÓN DEL STRING LEGAL EXIGIDO POR LA SUNAT PARA EL QR
    // =========================================================================
    const rucEmisor = invoice.rucEmisor || '20100066603';
    const tipoComprobante = invoice.documentType || '03'; 
    const serie = invoice.series || 'B001';
    const correlativo = String(invoice.correlative).padStart(8, '0');
    const totalIgv = (Number(invoice.totalIgv || 0)).toFixed(2);
    const totalVenta = (Number(invoice.totalVenta || 0)).toFixed(2);
    const fechaEmision = invoice.issueDate; 
    const tipoDocReceptor = invoice.customerIdentityType || '1'; 
    const numDocReceptor = invoice.customerIdentityNumber || '00000000';
    const digestValue = invoice.digestValue || '';

    const sunatQrString = `${rucEmisor}|${tipoComprobante}|${serie}|${correlativo}|${totalIgv}|${totalVenta}|${fechaEmision}|${tipoDocReceptor}|${numDocReceptor}|${digestValue}|`;

    // =========================================================================
    // 🎯 EL GRAN CAMBIO: GENERACIÓN DEL QR EN BASE64 LOCAL (INMUNE A SANITIZADORES)
    // =========================================================================
    let qrBase64Image = '';
    try {
      // El motor de QRCode dibuja la matriz en la RAM y nos devuelve un string data:image/png;base64
      qrBase64Image = await QRCode.toDataURL(sunatQrString, {
        margin: 1,
        width: 150,
        errorCorrectionLevel: 'M' // Estándar de densidad media para ticketeras térmicas
      });
    } catch (qrError) {
      console.error('🚨 Error al procesar el QR local en memoria:', qrError);
    }

    const ticketContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      box-sizing: border-box; margin: 0; padding: 0;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px; line-height: 1.3; color: #000000;
    }
    body { width: 76mm; padding: 2px; background-color: #ffffff; }
    .text-center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000000; margin: 6px 0; }
    .ruc-box { border: 1px solid #000000; padding: 4px; margin: 6px 0; font-size: 13px; }
    .tabla-items { width: 100%; border-collapse: collapse; margin: 4px 0; }
    .tabla-items th { border-bottom: 1px dashed #000000; padding: 3px 0; font-size: 11px; }
    .tabla-items td { padding: 4px 0; vertical-align: top; }
    .totales-wrapper { width: 100%; margin-top: 6px; }
    .total-row { display: flex; justify-content: space-between; padding: 2px 0; }
    .footer-ticket { margin-top: 12px; font-size: 10px; }
    .hash-signature { font-size: 9px; word-break: break-all; margin: 4px 0; }
    .qr-container { display: flex; justify-content: center; margin: 10px 0; }
    .qr-container img { width: 130px; height: 130px; }
  </style>
</head>
<body>
  <div class="text-center">
    <h1 style="font-size: 15px; text-transform: uppercase;">${invoice.companyName || 'TU EMPRESA S.A.C'}</h1>
    <div class="ruc-box bold">RUC: ${rucEmisor}</div>
    <div>${invoice.companyAddress || 'Lima, Peru'}</div>
  </div>
  <div class="divider"></div>
  <div>
    <div class="bold text-center" style="font-size: 13px;">
      ${tipoComprobante === '01' ? 'FACHURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA'}<br>
      ${serie}-${correlativo}
    </div>
    <div style="margin-top: 4px;">Fecha: ${invoice.issueDate} ${invoice.issueTime || ''}</div>
    <div>Moneda: ${invoice.currencyCode === 'PEN' ? 'Soles' : 'Dólares'}</div>
  </div>
  <div class="divider"></div>
  <div>
    <div class="bold">CLIENTE:</div>
    <div>${invoice.customerName}</div>
    <div>Doc: ${numDocReceptor}</div>
  </div>
  <div class="divider"></div>
  <table class="tabla-items">
    <thead>
      <tr>
        <th align="left" style="width: 50%;">Descripción</th>
        <th align="center" style="width: 15%;">Cant</th>
        <th align="right" style="width: 35%;">Importe</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>
  <div class="divider"></div>
  <div class="totales-wrapper">
    <div class="total-row"><span>Op. Gravada:</span><span>${invoice.currencyCode} ${(Number(invoice.totalGravada || 0)).toFixed(2)}</span></div>
    <div class="total-row"><span>I.G.V. (18%):</span><span>${invoice.currencyCode} ${(Number(invoice.totalIgv || 0)).toFixed(2)}</span></div>
    <div class="total-row bold" style="font-size: 13px; border-top: 1px solid #000000; padding-top: 4px;">
      <span>TOTAL VENTA:</span><span>${invoice.currencyCode} ${(Number(invoice.totalVenta)).toFixed(2)}</span>
    </div>
  </div>
  <div class="divider"></div>
  
  <!-- 🎯 INYECCIÓN DEL QR EN BASE64 (Angular lo leerá como texto nativo instantáneo) -->
  <div class="qr-container">
    <img src="${qrBase64Image}" alt="SUNAT QR" />
  </div>

  <div class="footer-ticket text-center">
    <div class="bold">SON: ${invoice.totalLetras || ''}</div>
    ${digestValue ? `<div class="divider"></div><div>Hash:</div><div class="hash-signature">\${digestValue}</div>` : ''}
    <div style="margin-top: 6px;" class="bold">Representación impresa del Comprobante Electrónico.</div>
    <div style="margin-top: 2px;">Consulte el XML o PDF ingresando a su portal corporativo.</div>
    <div style="margin-top: 4px; font-weight: bold;">¡Gracias por su compra!</div>
  </div>
</body>
</html>
    `;

    const doc = iframe.contentWindow?.document || iframe.contentDocument;

    if (doc) {
      doc.open();
      doc.write(ticketContent);
      doc.close();

      // Como la imagen ya está embebida en texto base64 dentro del HTML, 
      // no hay que esperar descargas de red externas. Imprimimos directamente.
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      // Limpieza de memoria RAM
      document.body.removeChild(iframe);
    }
  }
}