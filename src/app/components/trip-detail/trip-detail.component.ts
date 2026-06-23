import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Subscription } from 'rxjs';
import { TripService } from '../../services/trip.service';
import { Trip, Activity, Expense } from '../../models/trip.model';

const GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
  'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
];

const CATEGORY_LABELS: Record<string, string> = {
  transport: '交通',
  food: '餐飲',
  accommodation: '住宿',
  ticket: '門票',
  shopping: '購物',
  other: '其他',
  attraction: '景點',
};

@Component({
  selector: 'app-trip-detail',
  imports: [CommonModule, FormsModule, DecimalPipe, DragDropModule],
  templateUrl: './trip-detail.component.html',
  styleUrl: './trip-detail.component.css'
})
export class TripDetailComponent implements OnInit, OnDestroy {
  trip: Trip | undefined;
  activeTab: 'itinerary' | 'expenses' = 'itinerary';

  @ViewChild('dateStrip') dateStripRef?: ElementRef;
  allDays: Date[] = [];
  selectedDay: Date | null = null;
  dayActivities: Activity[] = [];

  showAddActivity = false;
  editingActivity: Activity | null = null;
  newActivity = this.emptyActivity();

  showAddExpense = false;
  newExpense = this.emptyExpense();

  private tripsSub?: Subscription;

  // Day map
  showDayMap = false;
  dayMapLoading = false;
  sortingInProgress = false;
  private leafletMap: any = null;
  private geocodeCache = new Map<string, { lat: number; lng: number }>();

  // Location preview map (add/edit form)
  locationPreviewCoords: { lat: number; lng: number } | null = null;
  locationPreviewLoading = false;
  private previewMap: any = null;
  private geocodeTimer: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tripService: TripService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.tripsSub = this.tripService.trips$.subscribe(() => this.loadTrip(id));
    }
  }

  loadTrip(id: string): void {
    if (!this.tripService.isLoaded) return;
    this.trip = this.tripService.getTripById(id);
    if (!this.trip) { this.router.navigate(['/']); return; }
    this.generateAllDays();
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  ngOnDestroy(): void {
    this.tripsSub?.unsubscribe();
    this.destroyLeafletMap();
    this.destroyPreviewMap();
  }

  /* ---------- Location preview map ---------- */

  onLocationInput(value: string): void {
    clearTimeout(this.geocodeTimer);
    if (!value.trim()) {
      this.locationPreviewCoords = null;
      this.destroyPreviewMap();
      return;
    }
    this.geocodeTimer = setTimeout(() => this.updateLocationPreview(value), 700);
  }

  private async updateLocationPreview(location: string): Promise<void> {
    this.locationPreviewLoading = true;
    const query = `${location} ${this.trip?.destination ?? ''}`;
    let coords = this.geocodeCache.get(location);
    if (!coords) {
      coords = await this.geocodeLocation(query) ?? undefined;
      if (coords) this.geocodeCache.set(location, coords);
    }
    this.locationPreviewLoading = false;
    this.locationPreviewCoords = coords ?? null;

    if (coords) {
      await new Promise(r => setTimeout(r, 60));
      await this.renderPreviewMap(coords);
    } else {
      this.destroyPreviewMap();
    }
  }

  private async renderPreviewMap(coords: { lat: number; lng: number }): Promise<void> {
    const container = document.getElementById('location-preview-map');
    if (!container) return;
    const L = await import('leaflet');

    if (this.previewMap) {
      this.previewMap.setView([coords.lat, coords.lng], 14);
      return;
    }

    this.previewMap = L.map(container, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd'
    }).addTo(this.previewMap);

    const icon = L.divIcon({
      className: '',
      html: `<div class="preview-pin"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    L.marker([coords.lat, coords.lng], { icon }).addTo(this.previewMap);
    this.previewMap.setView([coords.lat, coords.lng], 14);
  }

  private destroyPreviewMap(): void {
    if (this.previewMap) {
      this.previewMap.remove();
      this.previewMap = null;
    }
    this.locationPreviewCoords = null;
  }

  /* ---------- Day route map ---------- */

  async toggleDayMap(): Promise<void> {
    if (this.showDayMap) {
      this.showDayMap = false;
      this.destroyLeafletMap();
      return;
    }
    this.showDayMap = true;
    this.dayMapLoading = true;
    await this.initDayMap();
    this.dayMapLoading = false;
  }

  resetDayMap(): void {
    this.showDayMap = false;
    this.destroyLeafletMap();
  }

  private destroyLeafletMap(): void {
    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
    }
  }

  private async initDayMap(): Promise<void> {
    const activities = this.getActivitiesForSelectedDay().filter(a => a.location);
    if (activities.length === 0) return;

    const points: { lat: number; lng: number; title: string; location: string }[] = [];

    for (const act of activities) {
      const loc = act.location!;
      let coords = this.geocodeCache.get(loc);
      if (!coords) {
        coords = await this.geocodeLocation(`${loc} ${this.trip?.destination ?? ''}`) ?? undefined;
        if (coords) this.geocodeCache.set(loc, coords);
      }
      if (coords) points.push({ ...coords, title: act.title, location: loc });
    }

    if (points.length === 0) return;

    await new Promise(r => setTimeout(r, 80));

    const container = document.getElementById('day-route-map');
    if (!container) return;

    const L = await import('leaflet');
    this.destroyLeafletMap();

    this.leafletMap = L.map(container, { zoomControl: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      subdomains: 'abcd'
    }).addTo(this.leafletMap);

    const markers = points.map((p, i) => {
      const icon = L.divIcon({
        className: '',
        html: `<div class="route-num-marker">${i + 1}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -16]
      });
      return L.marker([p.lat, p.lng], { icon })
        .addTo(this.leafletMap)
        .bindPopup(`<b>${p.title}</b><br>${p.location}`);
    });

    if (points.length > 1) {
      const latlngs = points.map(p => [p.lat, p.lng] as [number, number]);
      L.polyline(latlngs, { color: '#e07454', weight: 3, dashArray: '8 6', opacity: 0.85 }).addTo(this.leafletMap);
    }

    this.leafletMap.fitBounds(L.featureGroup(markers).getBounds().pad(0.25));
  }

  private async geocodeLocation(query: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`
      );
      const json = await res.json();
      if (json.length > 0) return { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
    } catch {}
    return null;
  }

  getDayGoogleMapsRoute(): string {
    const locs = this.getActivitiesForSelectedDay()
      .filter(a => a.location)
      .map(a => encodeURIComponent(`${a.location} ${this.trip?.destination ?? ''}`));
    if (locs.length === 0) return '';
    if (locs.length === 1) return `https://www.google.com/maps/search/?api=1&query=${locs[0]}`;
    return `https://www.google.com/maps/dir/${locs.join('/')}`;
  }

  getGoogleMapsUrl(location: string): string {
    const query = encodeURIComponent(`${location} ${this.trip?.destination ?? ''}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  getGradient(id: string): string {
    return GRADIENTS[id.charCodeAt(0) % GRADIENTS.length];
  }

  /* ---------- Dates ---------- */

  formatFullDate(date: Date): string {
    return new Date(date).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  formatDayHeader(date: Date): string {
    return new Date(date).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' });
  }

  formatShortDate(date: Date): string {
    return new Date(date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
  }

  getDuration(startDate: Date, endDate: Date): number {
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }

  getDayNumber(date: Date): number {
    if (!this.trip) return 1;
    const diff = new Date(date).getTime() - new Date(this.trip.startDate).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  }

  toDate(value: string): Date {
    return new Date(value);
  }

  /* ---------- Stats ---------- */

  getCompletedCount(): number {
    return this.trip?.activities.filter(a => a.completed).length || 0;
  }

  getTotalSpent(): number {
    return (this.trip?.expenses || []).reduce((sum, e) => sum + e.amount, 0);
  }

  getBudgetPercent(): number {
    if (!this.trip?.budget) return 0;
    return (this.getTotalSpent() / this.trip.budget) * 100;
  }

  /* ---------- Activities ---------- */

  toggleAddActivity(): void {
    this.showAddActivity = !this.showAddActivity;
    if (this.showAddActivity && this.selectedDay) {
      this.newActivity.date = this.toInputDate(this.selectedDay);
    } else if (!this.showAddActivity) {
      this.newActivity = this.emptyActivity();
    }
  }

  addActivity(): void {
    if (!this.trip || !this.newActivity.title || !this.newActivity.date) return;
    this.tripService.addActivity(this.trip.id, {
      title: this.newActivity.title,
      date: new Date(this.newActivity.date),
      time: this.newActivity.time || undefined,
      location: this.newActivity.location || undefined,
      description: this.newActivity.description || undefined,
      category: this.newActivity.category,
      completed: false
    });
    this.newActivity = this.emptyActivity();
    this.showAddActivity = false;
  }

  startEditActivity(activity: Activity): void {
    this.editingActivity = { ...activity };
  }

  saveActivityEdit(): void {
    if (!this.trip || !this.editingActivity) return;
    this.tripService.updateActivity(this.trip.id, this.editingActivity.id, this.editingActivity);
    this.editingActivity = null;
  }

  cancelEditActivity(): void {
    this.editingActivity = null;
  }

  deleteActivity(activityId: string): void {
    if (!this.trip || !confirm('確定要刪除這個活動嗎？')) return;
    this.tripService.deleteActivity(this.trip.id, activityId);
  }

  toggleComplete(activityId: string): void {
    if (!this.trip) return;
    this.tripService.toggleActivityComplete(this.trip.id, activityId);
  }

  getDayLocations(activities: Activity[]): string[] {
    return [...activities]
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
      .map(a => a.location || a.title)
      .filter((s): s is string => !!s)
      .slice(0, 5);
  }

  getActivitiesByDate(): { date: Date; activities: Activity[] }[] {
    if (!this.trip) return [];
    const grouped = new Map<string, Activity[]>();
    this.trip.activities.forEach(a => {
      const key = new Date(a.date).toDateString();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(a);
    });
    return Array.from(grouped.entries())
      .map(([dateStr, activities]) => ({
        date: new Date(dateStr),
        activities: activities.sort((a, b) => (a.time || '').localeCompare(b.time || ''))
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /* ---------- Date strip ---------- */

  generateAllDays(): void {
    if (!this.trip) return;
    const days: Date[] = [];
    const start = new Date(this.trip.startDate);
    const end = new Date(this.trip.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    this.allDays = days;
    if (!this.selectedDay) this.selectedDay = days[0] ?? null;
  }

  selectDay(date: Date): void {
    this.selectedDay = date;
    this.resetDayMap();
    if (this.showAddActivity) this.newActivity.date = this.toInputDate(date);
    setTimeout(() => {
      const strip = this.dateStripRef?.nativeElement as HTMLElement | undefined;
      const active = strip?.querySelector('.date-tab.active') as HTMLElement | null;
      active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  }

  isSelectedDay(date: Date): boolean {
    return this.selectedDay?.toDateString() === date.toDateString();
  }

  hasActivitiesOnDay(date: Date): boolean {
    return (this.trip?.activities ?? []).some(
      a => new Date(a.date).toDateString() === date.toDateString()
    );
  }

  getActivitiesForSelectedDay(): Activity[] {
    if (!this.selectedDay || !this.trip) return [];
    return this.trip.activities
      .filter(a => new Date(a.date).toDateString() === this.selectedDay!.toDateString())
      .sort((a, b) => {
        if (a.sortOrder !== undefined && b.sortOrder !== undefined && a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }
        return (a.time ?? '').localeCompare(b.time ?? '');
      });
  }

  private readonly CATEGORY_ORDER: Record<string, number> = {
    transport: 0, attraction: 1, ticket: 2,
    food: 3, shopping: 4, other: 5, accommodation: 6
  };

  async autoSortActivities(): Promise<void> {
    if (!this.trip || !this.selectedDay || this.sortingInProgress) return;
    const activities = this.getActivitiesForSelectedDay();
    if (activities.length < 2) return;

    this.sortingInProgress = true;
    try {
      await this.runSmartSort(activities);
    } finally {
      this.sortingInProgress = false;
    }
  }

  private async runSmartSort(activities: Activity[]): Promise<void> {
    // Phase 1: geocode all located activities (respect Nominatim 1 req/sec)
    const coordsMap = new Map<string, { lat: number; lng: number }>();
    let lastRequestAt = 0;

    for (const act of activities) {
      if (!act.location) continue;
      const key = act.location;
      if (this.geocodeCache.has(key)) {
        coordsMap.set(act.id, this.geocodeCache.get(key)!);
      } else {
        const elapsed = Date.now() - lastRequestAt;
        if (lastRequestAt > 0 && elapsed < 1100) {
          await new Promise(r => setTimeout(r, 1100 - elapsed));
        }
        lastRequestAt = Date.now();
        const coords = await this.geocodeLocation(`${key} ${this.trip?.destination ?? ''}`);
        if (coords) {
          this.geocodeCache.set(key, coords);
          coordsMap.set(act.id, coords);
        }
      }
    }

    // Phase 2: split into anchors (have time, fixed order) and free
    const anchors = activities
      .filter(a => a.time)
      .sort((a, b) => a.time!.localeCompare(b.time!));
    const free = activities.filter(a => !a.time);

    const locatedFree = free.filter(a => coordsMap.has(a.id));
    const unlocatedFree = free.filter(a => !coordsMap.has(a.id));

    // Phase 3: insert located-free activities using cheapest-insertion heuristic
    const route: Activity[] = [...anchors];
    for (const act of locatedFree) {
      const actCoords = coordsMap.get(act.id)!;
      let bestPos = route.length;
      let bestCost = Infinity;

      for (let i = 0; i <= route.length; i++) {
        const cost = this.insertionCost(route, i, actCoords, coordsMap);
        if (cost < bestCost) {
          bestCost = cost;
          bestPos = i;
        }
      }
      route.splice(bestPos, 0, act);
    }

    // Phase 4: append unlocated-free sorted by category logic
    unlocatedFree.sort((a, b) =>
      (this.CATEGORY_ORDER[a.category ?? 'other'] ?? 5) -
      (this.CATEGORY_ORDER[b.category ?? 'other'] ?? 5)
    );

    const sorted = [...route, ...unlocatedFree];
    const updates = sorted.map((a, i) => ({ id: a.id, sortOrder: i }));
    updates.forEach(u => {
      const act = this.trip!.activities.find(a => a.id === u.id);
      if (act) act.sortOrder = u.sortOrder;
    });
    await this.tripService.reorderActivities(updates);
  }

  private insertionCost(
    route: Activity[],
    pos: number,
    newCoords: { lat: number; lng: number },
    coordsMap: Map<string, { lat: number; lng: number }>
  ): number {
    const prev = pos > 0 ? coordsMap.get(route[pos - 1].id) : undefined;
    const next = pos < route.length ? coordsMap.get(route[pos].id) : undefined;
    return (prev ? this.haversine(prev, newCoords) : 0) +
           (next ? this.haversine(newCoords, next) : 0) -
           (prev && next ? this.haversine(prev, next) : 0);
  }

  private haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  async onActivityDrop(event: CdkDragDrop<Activity[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) return;
    const activities = this.getActivitiesForSelectedDay();
    moveItemInArray(activities, event.previousIndex, event.currentIndex);
    const updates = activities.map((a, i) => ({ id: a.id, sortOrder: i }));
    // Optimistically update local state
    updates.forEach(u => {
      const act = this.trip!.activities.find(a => a.id === u.id);
      if (act) act.sortOrder = u.sortOrder;
    });
    await this.tripService.reorderActivities(updates);
  }

  formatTabDate(date: Date): string {
    return new Date(date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
  }

  formatTabWeekday(date: Date): string {
    return new Date(date).toLocaleDateString('zh-TW', { weekday: 'short' }).replace('週', '');
  }

  private toInputDate(date: Date): string {
    const d = new Date(date);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  /* ---------- Expenses ---------- */

  toggleAddExpense(): void {
    this.showAddExpense = !this.showAddExpense;
    if (!this.showAddExpense) this.newExpense = this.emptyExpense();
  }

  addExpense(): void {
    if (!this.trip || !this.newExpense.name || !this.newExpense.amount || !this.newExpense.date) return;
    this.tripService.addExpense(this.trip.id, {
      name: this.newExpense.name,
      amount: Number(this.newExpense.amount),
      currency: this.newExpense.currency,
      category: this.newExpense.category,
      date: new Date(this.newExpense.date),
      notes: this.newExpense.notes || undefined
    });
    this.newExpense = this.emptyExpense();
    this.showAddExpense = false;
  }

  deleteExpense(expenseId: string): void {
    if (!this.trip || !confirm('確定要刪除這筆花費嗎？')) return;
    this.tripService.deleteExpense(this.trip.id, expenseId);
  }

  getSortedExpenses(): Expense[] {
    return [...(this.trip?.expenses || [])].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  getExpenseCategories(): { key: string; label: string; total: number; percent: number }[] {
    const expenses = this.trip?.expenses || [];
    const totalSpent = this.getTotalSpent();
    const cats = ['transport', 'food', 'accommodation', 'ticket', 'shopping', 'other'];
    return cats
      .map(key => {
        const total = expenses.filter(e => e.category === key).reduce((s, e) => s + e.amount, 0);
        return { key, label: CATEGORY_LABELS[key], total, percent: totalSpent ? (total / totalSpent) * 100 : 0 };
      })
      .filter(c => c.total > 0);
  }

  getCategoryLabel(cat: string): string {
    return CATEGORY_LABELS[cat] || cat;
  }

  /* ---------- Helpers ---------- */

  private emptyActivity() {
    return {
      title: '',
      date: '',
      time: '',
      location: '',
      description: '',
      category: 'other' as Activity['category']
    };
  }

  private emptyExpense() {
    return {
      name: '',
      amount: 0,
      currency: 'TWD',
      category: 'other' as Expense['category'],
      date: '',
      notes: ''
    };
  }
}
