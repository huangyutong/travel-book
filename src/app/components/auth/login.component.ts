import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  email = '';
  password = '';
  loading = false;
  error = '';

  constructor(private authService: AuthService, private router: Router) {}

  async onSubmit(): Promise<void> {
    if (!this.email || !this.password) return;
    this.loading = true;
    this.error = '';
    const { error } = await this.authService.signIn(this.email, this.password);
    this.loading = false;
    if (error) {
      this.error = this.mapError(error.message);
    } else {
      this.router.navigate(['/']);
    }
  }

  async signInWithGoogle(): Promise<void> {
    this.loading = true;
    await this.authService.signInWithGoogle();
  }

  private mapError(msg: string): string {
    if (msg.includes('Invalid login credentials')) return 'Email 或密碼錯誤';
    if (msg.includes('Email not confirmed')) return '請先確認您的 Email';
    return msg;
  }
}
