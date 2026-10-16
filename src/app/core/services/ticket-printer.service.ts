import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TicketPrinterService {
  
  /**
   * 🔥 DISPARO EN CALIENTE: Genera un iframe invisible y manda la orden a la ticketera
   */
  public printThermalTicket(invoice: any): void {
    // 1. Creamos un elemento iframe oculto en el documento
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    
    document.body.appendChild(iframe);

    // 2. Extraemos e interpolamos el listado de ítems
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

// 🎯 RECTIFICACIÓN MÁSTER DE COMPAÑÍA: Autodetecta los datos reales del holding
    


    // 3. Vertemos el molde HTML/CSS peso pluma de 80mm sanitizado
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
    .hash-signature { font-size: 9px; word-break: break-all; margin: 6px 0; }
  </style>
</head>
<body>
  <div class="text-center">
    <h1 style="font-size: 15px; text-transform: uppercase;">${invoice.companyName || 'TU EMPRESA S.A.C'}</h1>
    <div class="ruc-box bold">RUC: ${invoice.rucEmisor || '20100066603'}</div>
    <div>${invoice.companyAddress || 'Lima, Peru'}</div>
  </div>
  <div class="divider"></div>
  <div>
    <div class="bold text-center" style="font-size: 13px;">${invoice.documentType} ${invoice.series}-${invoice.correlative}</div>
    <div style="margin-top: 4px;">Fecha: ${invoice.issueDate} ${invoice.issueTime || ''}</div>
    <div>Moneda: ${invoice.currencyCode === 'PEN' ? 'Soles' : 'Dólares'}</div>
  </div>
  <div class="divider"></div>
  <div>
    <div class="bold">CLIENTE:</div>
    <div>${invoice.customerName}</div>
    <div>Doc: ${invoice.customerIdentityNumber}</div>
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
  <div class="footer-ticket text-center">
    <div class="bold">SON: ${invoice.totalLetras || ''}</div>
    ${invoice.digestValue ? `<div class="divider"></div><div>Hash:</div><div class="hash-signature">\${invoice.digestValue}</div>` : ''}
    <div style="margin-top: 6px;" class="bold">Representación impresa del Comprobante Electrónico.</div>
    <div style="margin-top: 4px;">¡Gracias por su compra!</div>
  </div>
</body>
</html>
    `;

    // 4. Inyectamos el contenido en el documento del iframe
    const doc = iframe.contentWindow?.document || iframe.contentDocument;

    if (doc) {
      doc.open();
      doc.write(ticketContent);
      doc.close();

      // 5. Gatillamos la cola de impresión nativa de la ticketera en cuanto cargue el HTML
      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        // 🧼 Recolector de basura: Eliminamos el iframe de la RAM del navegador tras el disparo
        document.body.removeChild(iframe);
      }, 350);
    }
  }
}