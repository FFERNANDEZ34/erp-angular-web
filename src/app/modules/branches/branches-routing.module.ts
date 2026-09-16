import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BranchListComponent } from './pages/branch-list/branch-list.component';

const routes: Routes = [
  {
    path: '',
    children: [
      { path: 'branch-list', component: BranchListComponent, title: 'Holding - Sucursales y Almacenes' },
      { path: '', redirectTo: 'branch-list', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BranchesRoutingModule { }