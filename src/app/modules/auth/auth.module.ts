import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AuthRoutingModule } from './auth-routing.module';
import { LoginComponent } from './pages/login/login.component';
import { SubscribeComponent } from './pages/subscribe/subscribe.component';
import { ConfirmEmailComponent } from './pages/confirm-email/confirm-email.component';
import { ChangePasswordComponent } from './pages/change-password/change-password.component';

@NgModule({
  declarations: [
    // Aquí declararemos los componentes de Login y Subscribe más adelante
  
    LoginComponent,
    SubscribeComponent,
    ConfirmEmailComponent,
    ChangePasswordComponent
  ],
  imports: [
    CommonModule,
    AuthRoutingModule,
    FormsModule,
    ReactiveFormsModule
  ]
})
export class AuthModule { }