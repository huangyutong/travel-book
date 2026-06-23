import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { Trip, Activity, Expense } from '../models/trip.model';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class TripService implements OnDestroy {
  private tripsSubject = new BehaviorSubject<Trip[]>([]);
  trips$: Observable<Trip[]> = this.tripsSubject.asObservable();
  isLoaded = false;

  private authSub: Subscription;

  constructor(private supabase: SupabaseService, private authService: AuthService) {
    this.authSub = this.authService.user$.subscribe(user => {
      if (user) {
        this.loadTrips();
      } else {
        this.tripsSubject.next([]);
        this.isLoaded = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.authSub.unsubscribe();
  }

  private async loadTrips(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('trips')
      .select('*, activities(*), expenses(*)')
      .order('start_date', { ascending: false });

    if (error) { console.error('loadTrips error:', error); return; }

    this.tripsSubject.next((data ?? []).map(row => this.mapRow(row)));
    this.isLoaded = true;
  }

  private mapRow(row: any): Trip {
    return {
      id: row.id,
      title: row.title,
      destination: row.destination,
      startDate: new Date(row.start_date),
      endDate: new Date(row.end_date),
      description: row.description ?? undefined,
      budget: row.budget ?? undefined,
      imageUrl: row.image_url ?? undefined,
      coverGradient: row.cover_gradient ?? undefined,
      lat: row.lat ?? undefined,
      lng: row.lng ?? undefined,
      activities: (row.activities ?? []).map((a: any): Activity => ({
        id: a.id,
        title: a.title,
        date: new Date(a.date),
        time: a.time ?? undefined,
        location: a.location ?? undefined,
        description: a.description ?? undefined,
        completed: a.completed,
        category: a.category ?? undefined,
        sortOrder: a.sort_order ?? 0
      })),
      expenses: (row.expenses ?? []).map((e: any): Expense => ({
        id: e.id,
        name: e.name,
        amount: e.amount,
        currency: e.currency,
        category: e.category,
        date: new Date(e.date),
        notes: e.notes ?? undefined
      }))
    };
  }

  private updateTrips(fn: (trips: Trip[]) => Trip[]): void {
    this.tripsSubject.next(fn(this.tripsSubject.value));
  }

  getTripById(id: string): Trip | undefined {
    return this.tripsSubject.value.find(t => t.id === id);
  }

  private async geocode(destination: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'zh-TW,zh,en' } }
      );
      const json = await res.json();
      if (json.length > 0) {
        return { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
      }
    } catch (e) {
      console.warn('geocode failed:', e);
    }
    return null;
  }

  async addTrip(trip: Omit<Trip, 'id'>): Promise<Trip | null> {
    const userId = this.authService.currentUser?.id;
    if (!userId) { console.error('addTrip failed: user not logged in'); return null; }

    const coords = await this.geocode(trip.destination);

    const { data, error } = await this.supabase.client
      .from('trips')
      .insert({
        user_id: userId,
        title: trip.title,
        destination: trip.destination,
        start_date: this.toDateStr(trip.startDate),
        end_date: this.toDateStr(trip.endDate),
        description: trip.description ?? null,
        budget: trip.budget ?? null,
        image_url: trip.imageUrl ?? null,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null
      })
      .select()
      .single();

    if (error || !data) { console.error(error); return null; }

    const newTrip = this.mapRow({ ...data, activities: [], expenses: [] });
    this.updateTrips(trips => [newTrip, ...trips]);
    this.isLoaded = true;
    return newTrip;
  }

  async updateTrip(id: string, updates: Partial<Trip>, regeocode = false): Promise<void> {
    const patch: Record<string, unknown> = {};
    if (updates.title !== undefined) patch['title'] = updates.title;
    if (updates.destination !== undefined) patch['destination'] = updates.destination;
    if (updates.startDate !== undefined) patch['start_date'] = this.toDateStr(updates.startDate);
    if (updates.endDate !== undefined) patch['end_date'] = this.toDateStr(updates.endDate);
    if (updates.description !== undefined) patch['description'] = updates.description;
    if (updates.budget !== undefined) patch['budget'] = updates.budget;
    if (updates.imageUrl !== undefined) patch['image_url'] = updates.imageUrl;

    const localUpdates: Partial<Trip> = { ...updates };
    if (regeocode && updates.destination) {
      const coords = await this.geocode(updates.destination);
      if (coords) {
        patch['lat'] = coords.lat;
        patch['lng'] = coords.lng;
        localUpdates.lat = coords.lat;
        localUpdates.lng = coords.lng;
      }
    }

    await this.supabase.client.from('trips').update(patch).eq('id', id);
    this.updateTrips(trips => trips.map(t => t.id === id ? { ...t, ...localUpdates } : t));
  }

  async deleteTrip(id: string): Promise<void> {
    await this.supabase.client.from('trips').delete().eq('id', id);
    this.updateTrips(trips => trips.filter(t => t.id !== id));
  }

  async addActivity(tripId: string, activity: Omit<Activity, 'id'>): Promise<void> {
    const { data, error } = await this.supabase.client.from('activities').insert({
      trip_id: tripId,
      title: activity.title,
      date: this.toDateStr(activity.date),
      time: activity.time ?? null,
      location: activity.location ?? null,
      description: activity.description ?? null,
      completed: activity.completed,
      category: activity.category ?? null
    }).select().single();

    if (error || !data) { console.error(error); return; }

    const newActivity: Activity = {
      id: data.id,
      title: data.title,
      date: new Date(data.date),
      time: data.time ?? undefined,
      location: data.location ?? undefined,
      description: data.description ?? undefined,
      completed: data.completed,
      category: data.category ?? undefined,
      sortOrder: data.sort_order ?? 0
    };

    this.updateTrips(trips => trips.map(t =>
      t.id === tripId ? { ...t, activities: [...t.activities, newActivity] } : t
    ));
  }

  async updateActivity(tripId: string, activityId: string, updates: Partial<Activity>): Promise<void> {
    const patch: Record<string, unknown> = {};
    if (updates.title !== undefined) patch['title'] = updates.title;
    if (updates.date !== undefined) patch['date'] = this.toDateStr(new Date(updates.date));
    if (updates.time !== undefined) patch['time'] = updates.time;
    if (updates.location !== undefined) patch['location'] = updates.location;
    if (updates.description !== undefined) patch['description'] = updates.description;
    if (updates.completed !== undefined) patch['completed'] = updates.completed;
    if (updates.category !== undefined) patch['category'] = updates.category;

    await this.supabase.client.from('activities').update(patch).eq('id', activityId);
    this.updateTrips(trips => trips.map(t => {
      if (t.id !== tripId) return t;
      return { ...t, activities: t.activities.map(a => a.id === activityId ? { ...a, ...updates } : a) };
    }));
  }

  async reorderActivities(updates: { id: string; sortOrder: number }[]): Promise<void> {
    await Promise.all(
      updates.map(u => this.supabase.client.from('activities').update({ sort_order: u.sortOrder }).eq('id', u.id))
    );
    const orderMap = new Map(updates.map(u => [u.id, u.sortOrder]));
    this.updateTrips(trips => trips.map(t => ({
      ...t,
      activities: t.activities.map(a => orderMap.has(a.id) ? { ...a, sortOrder: orderMap.get(a.id)! } : a)
    })));
  }

  async deleteActivity(tripId: string, activityId: string): Promise<void> {
    await this.supabase.client.from('activities').delete().eq('id', activityId);
    this.updateTrips(trips => trips.map(t => {
      if (t.id !== tripId) return t;
      return { ...t, activities: t.activities.filter(a => a.id !== activityId) };
    }));
  }

  async toggleActivityComplete(tripId: string, activityId: string): Promise<void> {
    const activity = this.getTripById(tripId)?.activities.find(a => a.id === activityId);
    if (!activity) return;
    const newCompleted = !activity.completed;

    this.updateTrips(trips => trips.map(t => {
      if (t.id !== tripId) return t;
      return { ...t, activities: t.activities.map(a => a.id === activityId ? { ...a, completed: newCompleted } : a) };
    }));

    await this.supabase.client.from('activities').update({ completed: newCompleted }).eq('id', activityId);
  }

  async addExpense(tripId: string, expense: Omit<Expense, 'id'>): Promise<void> {
    const { data, error } = await this.supabase.client.from('expenses').insert({
      trip_id: tripId,
      name: expense.name,
      amount: expense.amount,
      currency: expense.currency,
      category: expense.category,
      date: this.toDateStr(expense.date),
      notes: expense.notes ?? null
    }).select().single();

    if (error || !data) { console.error(error); return; }

    const newExpense: Expense = {
      id: data.id,
      name: data.name,
      amount: data.amount,
      currency: data.currency,
      category: data.category,
      date: new Date(data.date),
      notes: data.notes ?? undefined
    };

    this.updateTrips(trips => trips.map(t =>
      t.id === tripId ? { ...t, expenses: [...t.expenses, newExpense] } : t
    ));
  }

  async deleteExpense(tripId: string, expenseId: string): Promise<void> {
    await this.supabase.client.from('expenses').delete().eq('id', expenseId);
    this.updateTrips(trips => trips.map(t => {
      if (t.id !== tripId) return t;
      return { ...t, expenses: t.expenses.filter(e => e.id !== expenseId) };
    }));
  }

  private toDateStr(date: Date): string {
    const d = new Date(date);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }
}
