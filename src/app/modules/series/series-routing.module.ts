import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SeriesListComponent } from './pages/series-list/series-list.component';

const routes: Routes = [
  {
    path: '',
    children: [
      { path: 'series-list', component: SeriesListComponent, title: 'Holding - Talonarios y Series' },
      { path: '', redirectTo: 'series-list', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SeriesRoutingModule { }