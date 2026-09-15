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
      { path: '', redirectTo: 'entities', pathMatch: 'full' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PrincipalRoutingModule {}
