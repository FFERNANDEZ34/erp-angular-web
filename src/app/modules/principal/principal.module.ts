import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrincipalRoutingModule } from './principal-routing.module';
import { LayoutComponent } from './layout/layout.component';
import { SecurityMatrixComponent } from './pages/security-matrix/security-matrix.component';

@NgModule({
  declarations: [LayoutComponent, SecurityMatrixComponent],
  imports: [CommonModule, PrincipalRoutingModule, FormsModule],
})
export class PrincipalModule {}
