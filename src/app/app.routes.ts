import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/trip-list/trip-list.component').then(m => m.TripListComponent),
    canActivate: [authGuard]
  },
  {
    path: 'add-trip',
    loadComponent: () => import('./components/add-trip/add-trip.component').then(m => m.AddTripComponent),
    canActivate: [authGuard]
  },
  {
    path: 'edit-trip/:id',
    loadComponent: () => import('./components/edit-trip/edit-trip.component').then(m => m.EditTripComponent),
    canActivate: [authGuard]
  },
  {
    path: 'trip/:id',
    loadComponent: () => import('./components/trip-detail/trip-detail.component').then(m => m.TripDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'login',
    loadComponent: () => import('./components/auth/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./components/auth/register.component').then(m => m.RegisterComponent),
    canActivate: [guestGuard]
  },
  { path: '**', redirectTo: '' }
];
