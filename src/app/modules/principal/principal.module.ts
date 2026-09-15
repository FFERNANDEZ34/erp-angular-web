import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrincipalRoutingModule } from './principal-routing.module';
import { LayoutComponent } from './layout/layout.component';

@NgModule({
  declarations: [LayoutComponent],
  imports: [CommonModule, PrincipalRoutingModule, FormsModule],
})
export class PrincipalModule {}
