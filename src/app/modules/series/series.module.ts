import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SeriesRoutingModule } from './series-routing.module';
import { SeriesListComponent } from './pages/series-list/series-list.component';

@NgModule({
  declarations: [
    SeriesListComponent
  ],
  imports: [
    CommonModule,
    SeriesRoutingModule,
    FormsModule,
    ReactiveFormsModule
  ]
})
export class SeriesModule { }