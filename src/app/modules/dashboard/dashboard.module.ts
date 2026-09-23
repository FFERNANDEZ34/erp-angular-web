import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // 🎯 Mandatorio para que funcionen los comboboxes [(ngModel)]
import { ManagerDashboardComponent } from './pages/manager-dashboard/manager-dashboard.component';
import { DashboardRoutingModule } from './dashboard-routing.module'; // 🚀 Tu nuevo enrutador local

@NgModule({
  declarations: [
    ManagerDashboardComponent
  ],
  imports: [
    CommonModule,
    FormsModule,            // 🎯 ¡Inyectado aquí adentro!
    DashboardRoutingModule // 🚀 ¡Inyectado aquí adentro!
  ]
})
export class DashboardModule { }