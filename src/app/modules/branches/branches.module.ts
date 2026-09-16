import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BranchesRoutingModule } from './branches-routing.module';
import { BranchListComponent } from './pages/branch-list/branch-list.component';

@NgModule({
  declarations: [
    BranchListComponent
  ],
  imports: [
    CommonModule,
    BranchesRoutingModule,
    FormsModule,
    ReactiveFormsModule
  ]
})
export class BranchesModule { }