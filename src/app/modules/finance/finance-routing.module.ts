import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CurrencyExchangeComponent } from './pages/currency-exchange/currency-exchange.component';

const routes: Routes = [
  {
    path: '',
    children: [
      { path: 'currency-exchange', component: CurrencyExchangeComponent, title: 'Finanzas - Tipo de Cambio Diario' },
      { path: '', redirectTo: 'currency-exchange', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InventoryRoutingModule { } 