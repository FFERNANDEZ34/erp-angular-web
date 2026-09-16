import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CompanyListComponent } from './pages/company-list/company-list.component';

const routes: Routes = [
  {
    path: '',
    children: [
      { path: 'company-list', component: CompanyListComponent, title: 'Holding - Control de Compañías' },
      { path: '', redirectTo: 'company-list', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CompaniesRoutingModule { }