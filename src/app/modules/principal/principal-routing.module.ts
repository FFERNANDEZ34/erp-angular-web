import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { authGuard } from '../../core/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard], // 🔒 Protegemos todo el entorno operativo del ERP
    children: [
      // Las pantallas internas variarán y se inyectarán en el <router-outlet> del layout
      {
        path: 'entities',
        loadChildren: () =>
          import('../entities/entities.module').then((m) => m.EntitiesModule),
      },
      {
        path: 'inventory',
        loadChildren: () => import('../inventory/inventory.module').then(m => m.InventoryModule)
      },
      { 
        path: 'finance', 
        loadChildren: () => import('../finance/finance.module').then(m => m.FinanceModule) 
      },
      { 
        path: 'companies', 
        loadChildren: () => import('../companies/companies.module').then(m => m.CompaniesModule) 
      },
       { 
        path: 'branches', 
        loadChildren: () => import('../branches/branches.module').then(m => m.BranchesModule) 
      },
       { 
        path: 'series', 
        loadChildren: () => import('../series/series.module').then(m => m.SeriesModule) 
      },
      { 
        path: 'invoices', 
        loadChildren: () => import('../invoices/invoices.module').then(m => m.InvoicesModule) 
      },
      { path: '', redirectTo: 'entities', pathMatch: 'full' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PrincipalRoutingModule {}
