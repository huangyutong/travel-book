import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  user$ = this.userSubject.asObservable();

  constructor(private supabaseService: SupabaseService) {
    this.supabaseService.client.auth.getSession().then(({ data }) => {
      this.userSubject.next(data.session?.user ?? null);
    });

    this.supabaseService.client.auth.onAuthStateChange((_event, session) => {
      this.userSubject.next(session?.user ?? null);
    });
  }

  get currentUser(): User | null {
    return this.userSubject.value;
  }

  getSession() {
    return this.supabaseService.client.auth.getSession();
  }

  async signUp(email: string, password: string) {
    return this.supabaseService.client.auth.signUp({ email, password });
  }

  async signIn(email: string, password: string) {
    return this.supabaseService.client.auth.signInWithPassword({ email, password });
  }

  async signInWithGoogle() {
    return this.supabaseService.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/') }
    });
  }

  async signOut() {
    return this.supabaseService.client.auth.signOut();
  }
}
