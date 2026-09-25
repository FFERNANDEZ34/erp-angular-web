import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule,ReactiveFormsModule  } from '@angular/forms';
import { PrincipalRoutingModule } from './principal-routing.module';
import { LayoutComponent } from './layout/layout.component';
import { SecurityMatrixComponent } from './pages/security-matrix/security-matrix.component';
import { UserCrudComponent } from './pages/user-crud/user-crud.component';

@NgModule({
  declarations: [LayoutComponent, SecurityMatrixComponent, UserCrudComponent],
  imports: [CommonModule, PrincipalRoutingModule, FormsModule,ReactiveFormsModule ],
})
export class PrincipalModule {}
