import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProductListComponent } from './pages/product-list/product-list.component';
import { KardexMonitorComponent } from './pages/kardex-monitor/kardex-monitor.component';
import { StockEntryFormComponent } from './pages/stock-entry-form/stock-entry-form.component';
import { InventoryDashboardComponent } from './pages/inventory-dashboard/inventory-dashboard.component';

const routes: Routes = [
  
  {
    path: '',
    children: [
      {
        path: 'products',
        component: ProductListComponent,
        title: 'Inventario - Catálogo de Productos',
      },
      { path: '', redirectTo: 'products', pathMatch: 'full' },
      { 
        path: 'kardex', 
        component: KardexMonitorComponent 
      },
      { path: 'kardex/ingress', component: StockEntryFormComponent },
       { path: 'analytics', component: InventoryDashboardComponent }
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class InventoryRoutingModule {}
