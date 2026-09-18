import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InvoiceListComponent } from './pages/invoice-list/invoice-list.component';
import { InvoiceFormComponent } from './pages/invoice-form/invoice-form.component';

const routes: Routes = [
  {
    path: '',
    children: [
      // 📑 Pantalla A: Grilla histórica de comprobantes emitidos
      { 
        path: 'invoice-list', 
        component: InvoiceListComponent, 
        title: 'Holding - Registro de Ventas' 
      },
      // 🚀 Pantalla B: Punto de Venta / Formulario complejo de emisión directa
      { 
        path: 'new', 
        component: InvoiceFormComponent, 
        title: 'Holding - Emitir Comprobante' 
      },
      { 
        path: '', 
        redirectTo: 'invoice-list', 
        pathMatch: 'full' 
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InvoicesRoutingModule { }