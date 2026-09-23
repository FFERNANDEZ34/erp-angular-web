import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ManagerDashboardComponent } from './pages/manager-dashboard/manager-dashboard.component';

const routes: Routes = [
  {
    path: '',
    children: [
      // 🎯 EL DESTRABE DE RUTAS GERENCIAL:
      // Mapeamos la URL /analytics vinculada estrictamente al búnker gráfico de Chart.js
      { 
        path: 'analytics', 
        component: ManagerDashboardComponent 
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DashboardRoutingModule { }