import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EntityListComponent } from './pages/entity-list/entity-list.component';

const routes: Routes = [
  { path: '', component: EntityListComponent } // ✅ Al entrar a /principal/entities se pintará este componente
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EntitiesRoutingModule { }