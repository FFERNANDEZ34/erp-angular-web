import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { InventoryRoutingModule } from './inventory-routing.module';
import { ProductListComponent } from './pages/product-list/product-list.component';
import { KardexMonitorComponent } from './pages/kardex-monitor/kardex-monitor.component';
import { StockEntryFormComponent } from './pages/stock-entry-form/stock-entry-form.component';



@NgModule({
  declarations: [
    ProductListComponent,
    KardexMonitorComponent,
    StockEntryFormComponent
  ],
  imports: [
    CommonModule,
    InventoryRoutingModule,
    FormsModule,
    ReactiveFormsModule
  ]
})
export class InventoryModule { }