import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { EntitiesRoutingModule } from './entities-routing.module';
import { EntityListComponent } from './pages/entity-list/entity-list.component';

@NgModule({
  declarations: [
    EntityListComponent // ✅ Declaramos el componente de la lista
  ],
  imports: [
    CommonModule,
    EntitiesRoutingModule,
    FormsModule,
    ReactiveFormsModule
  ]
})
export class EntitiesModule { }