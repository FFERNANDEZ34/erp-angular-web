import { Injectable } from '@angular/core';
import * as QRCode from 'qrcode';

@Injectable({
  providedIn: 'root'
})
export class TicketPrinterService {

  public async printThermalTicket(invoice: any): Promise<void> {

    const iframe = document.createElement('iframe');

    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';

    document.body.appendChild(iframe);

    const itemsHtml =
      invoice?.Details?.map((item: any) => `
        <tr>
          <td align="left">
            ${item.productName || item.productCode || ''}
            <br>
            <small style="font-size:10px">
              P.U: ${(Number(item.unitPrice || 0)).toFixed(2)}
            </small>
          </td>

          <td align="center">
            ${Number(item.quantity || 0)}
          </td>

          <td align="right">
            ${(Number(item.subtotalPrice || 0)).toFixed(2)}
          </td>
        </tr>
      `).join('') || '';

    // ==========================
    // DATOS QR SUNAT
    // ==========================

    const rucEmisor =
      invoice.rucEmisor || '20100066603';

    const tipoComprobante =
      invoice.documentType || '03';

    const serie =
      invoice.series || 'B001';

    const correlativo =
      invoice.correlative != null
        ? String(invoice.correlative)
        : '';

    const totalIgv =
      Number(invoice.totalIgv || 0).toFixed(2);

    const totalVenta =
      Number(invoice.totalVenta || 0).toFixed(2);

    const fechaEmision =
      invoice.issueDate || '';

    const tipoDocReceptor =
      invoice.customerIdentityType || '1';

    const numDocReceptor =
      invoice.customerIdentityNumber || '';

    const digestValue =
      invoice.digestValue || '';

    const sunatQrString =
      `${rucEmisor}|${tipoComprobante}|${serie}|${correlativo}|${totalIgv}|${totalVenta}|${fechaEmision}|${tipoDocReceptor}|${numDocReceptor}|${digestValue}|`;

    console.log('QR SUNAT');
    console.log(sunatQrString);

    let qrBase64Image = '';

    try {

      qrBase64Image = await QRCode.toDataURL(
        sunatQrString,
        {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 180
        }
      );

      console.log('QR generado correctamente');

    } catch (error) {

      console.error(
        'Error generando QR',
        error
      );
    }

    const ticketContent = `
<!DOCTYPE html>
<html>

<head>

<meta charset="UTF-8">

<title>Ticket</title>

<style>

*{
  margin:0;
  padding:0;
  box-sizing:border-box;
  font-family:'Courier New', monospace;
  color:#000;
}

body{
  width:72mm;
  padding:4px;
  background:#fff;
  font-size:12px;
}

.text-center{
  text-align:center;
}

.bold{
  font-weight:bold;
}

.divider{
  border-top:1px dashed #000;
  margin:6px 0;
}

.ruc-box{
  border:1px solid #000;
  padding:4px;
  margin:6px 0;
}

.tabla-items{
  width:100%;
  border-collapse:collapse;
}

.tabla-items th{
  border-bottom:1px dashed #000;
  padding:3px 0;
}

.tabla-items td{
  padding:4px 0;
  vertical-align:top;
}

.total-row{
  display:flex;
  justify-content:space-between;
  margin:2px 0;
}

.qr-container{
  display:flex;
  justify-content:center;
  align-items:center;
  margin:12px 0;
}

.qr-container img{
  width:150px;
  height:150px;
  display:block;
}

.hash-signature{
  font-size:9px;
  word-break:break-all;
}

.footer-ticket{
  margin-top:10px;
}

</style>

</head>

<body>

<div class="text-center">

  <div
    style="
      font-size:15px;
      font-weight:bold;
      text-transform:uppercase;
    ">

    ${invoice.companyName || 'TU EMPRESA S.A.C'}

  </div>

  <div class="ruc-box">
    RUC: ${rucEmisor}
  </div>

  <div>
    ${invoice.companyAddress || ''}
  </div>

</div>

<div class="divider"></div>

<div class="text-center">

  <div
    style="
      font-size:14px;
      font-weight:bold;
    ">

    ${
      tipoComprobante === '01'
        ? 'FACTURA ELECTRÓNICA'
        : 'BOLETA DE VENTA ELECTRÓNICA'
    }

  </div>

  <div>
    ${serie}-${correlativo}
  </div>

</div>

<div style="margin-top:5px">

Fecha:
${invoice.issueDate || ''}
${invoice.issueTime || ''}

</div>

<div>

Moneda:
${invoice.currencyCode === 'USD'
  ? 'Dólares'
  : 'Soles'}

</div>

<div class="divider"></div>

<div>

  <div class="bold">
    CLIENTE:
  </div>

  <div>
    ${invoice.customerName || ''}
  </div>

  <div>
    Doc: ${numDocReceptor}
  </div>

</div>

<div class="divider"></div>

<table class="tabla-items">

<thead>

<tr>
  <th align="left">Descripción</th>
  <th align="center">Cant</th>
  <th align="right">Importe</th>
</tr>

</thead>

<tbody>

${itemsHtml}

</tbody>

</table>

<div class="divider"></div>

<div>

<div class="total-row">

<span>
  Op. Gravada:
</span>

<span>
  ${invoice.currencyCode}
  ${Number(invoice.totalGravada || 0).toFixed(2)}
</span>

</div>

<div class="total-row">

<span>
  IGV:
</span>

<span>
  ${invoice.currencyCode}
  ${Number(invoice.totalIgv || 0).toFixed(2)}
</span>

</div>

<div
class="total-row bold"
style="
border-top:1px solid #000;
padding-top:4px;
">

<span>TOTAL:</span>

<span>
  ${invoice.currencyCode}
  ${Number(invoice.totalVenta || 0).toFixed(2)}
</span>

</div>

</div>

<div class="divider"></div>
${
  qrBase64Image
    ? `
      <div class="qr-container">
        <img
          id="qrImg"
          src="${qrBase64Image}"
          alt="QR SUNAT"
        />
      </div>
      `
    : ''
}

<div class="footer-ticket text-center">

  <div class="bold">

    SON:
    ${invoice.totalLetras || ''}

  </div>

  ${
    digestValue
      ? `
      <div class="divider"></div>

      <div>
        Hash:
      </div>

      <div class="hash-signature">
        ${digestValue}
      </div>
      `
      : ''
  }

  <div style="margin-top:8px;">

    Representación impresa del
    Comprobante Electrónico

  </div>

  <div style="margin-top:4px;">

    Consulte el XML o PDF
    desde el portal corporativo

  </div>

  <div
    style="
    margin-top:8px;
    font-weight:bold;
    ">

    ¡Gracias por su compra!

  </div>

</div>

</body>
</html>
`;

    const doc =
      iframe.contentDocument ||
      iframe.contentWindow?.document;

    if (!doc) {

      console.error(
        'No fue posible obtener el documento del iframe'
      );

      return;
    }

    doc.open();
    doc.write(ticketContent);
    doc.close();

    const printTicket = () => {

      try {

        iframe.contentWindow?.focus();

        setTimeout(() => {

          iframe.contentWindow?.print();

          setTimeout(() => {

            if (document.body.contains(iframe)) {

              document.body.removeChild(iframe);

            }

          }, 2000);

        }, 300);

      } catch (error) {

        console.error(
          'Error al imprimir ticket',
          error
        );

      }
    };

    // =====================================================
    // ESPERAR A QUE EL QR TERMINE DE CARGAR
    // =====================================================

    setTimeout(() => {

      const qrImg =
        doc.getElementById(
          'qrImg'
        ) as HTMLImageElement | null;

      if (!qrImg) {

        console.warn(
          'No existe imagen QR, se imprimirá de todas formas'
        );

        printTicket();

        return;
      }

      if (qrImg.complete) {

        console.log(
          'QR completamente cargado'
        );

        printTicket();

        return;
      }

      qrImg.onload = () => {

        console.log(
          'QR renderizado correctamente'
        );

        printTicket();
      };

      qrImg.onerror = () => {

        console.error(
          'Error cargando QR'
        );

        printTicket();
      };

      // Timeout de respaldo
      setTimeout(() => {

        console.warn(
          'Timeout esperando QR, imprimiendo de todas formas'
        );

        printTicket();

      }, 3000);

    }, 500);

  }

}