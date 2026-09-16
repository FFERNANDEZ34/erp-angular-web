import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EntityListComponent } from './pages/entity-list/entity-list.component';

const routes: Routes = [
  {
    path: '',
    children: [
      { 
        path: 'entity-list', 
        component: EntityListComponent, 
        title: 'Holding - Clientes y Proveedores' 
      },
      { 
        path: '', 
        redirectTo: 'entity-list', 
        pathMatch: 'full' 
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EntitiesRoutingModule { }