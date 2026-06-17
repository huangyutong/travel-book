import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './login.component.css'
})
export class RegisterComponent {
  email = '';
  password = '';
  confirmPassword = '';
  loading = false;
  error = '';
  success = '';

  constructor(private authService: AuthService, private router: Router) {}

  async onSubmit(): Promise<void> {
    if (!this.email || !this.password || !this.confirmPassword) return;
    if (this.password !== this.confirmPassword) {
      this.error = '兩次密碼輸入不一致';
      return;
    }
    if (this.password.length < 6) {
      this.error = '密碼至少需要 6 個字元';
      return;
    }
    this.loading = true;
    this.error = '';
    const { error } = await this.authService.signUp(this.email, this.password);
    this.loading = false;
    if (error) {
      this.error = this.mapError(error.message);
    } else {
      this.success = '註冊成功！請確認您的 Email 後再登入。';
    }
  }

  async signInWithGoogle(): Promise<void> {
    this.loading = true;
    await this.authService.signInWithGoogle();
  }

  private mapError(msg: string): string {
    if (msg.includes('already registered')) return '此 Email 已經註冊過了';
    if (msg.includes('Password should be')) return '密碼至少需要 6 個字元';
    return msg;
  }
}
