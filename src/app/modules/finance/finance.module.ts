import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { InventoryRoutingModule } from './finance-routing.module';
import { CurrencyExchangeComponent } from './pages/currency-exchange/currency-exchange.component';

@NgModule({
  declarations: [
    CurrencyExchangeComponent
  ],
  imports: [
    CommonModule,
    InventoryRoutingModule,
    FormsModule,
    ReactiveFormsModule
  ]
})
export class FinanceModule { }