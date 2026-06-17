import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const authGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);
  const { data: { user } } = await supabase.client.auth.getUser();
  return user ? true : router.createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);
  const { data: { user } } = await supabase.client.auth.getUser();
  return user ? router.createUrlTree(['/']) : true;
};
