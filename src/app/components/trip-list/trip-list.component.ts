import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TripService } from '../../services/trip.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { Trip } from '../../models/trip.model';
import { Subscription } from 'rxjs';

type GlobeLoadState = 'loading-engine' | 'loading-data' | 'rendering' | 'ready' | 'fallback' | 'failed';

interface TripMapGroup {
  key: string;
  label: string;
  count: number;
  lat: number;
  lng: number;
  color: string;
  tripIds: string[];
}

const PIN_COLORS = [
  '#667eea', '#f5576c', '#4facfe', '#43e97b',
  '#fa709a', '#a18cd1', '#fccb90', '#8ec5fc'
];

const COUNTRIES_GEOJSON_URL = 'ne_110m_admin_0_countries.geojson';
const GLOBE_LOAD_TIMEOUT_MS = 8000;

@Component({
  selector: 'app-trip-list',
  imports: [CommonModule],
  templateUrl: './trip-list.component.html',
  styleUrl: './trip-list.component.css'
})
export class TripListComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  @ViewChild('map2dEl') map2dEl!: ElementRef;

  trips: Trip[] = [];
  tripToDelete: Trip | null = null;
  globeReady = false;

  weatherCity = '';
  weatherCountry = '';
  weatherTemp: number | null = null;
  weatherCode: number | null = null;
  weatherHumidity: number | null = null;
  weatherLoading = false;
  weatherError = false;

  filterYear: number | null = null;
  filterCountry: string | null = null;

  get availableYears(): number[] {
    const years = new Set(this.trips.map(t => new Date(t.startDate).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }

  get availableCountries(): string[] {
    const dests = new Set(this.trips.map(t => t.destination).filter(Boolean));
    return Array.from(dests).sort();
  }

  get filteredTrips(): Trip[] {
    return this.trips.filter(t => {
      const yearOk = !this.filterYear || new Date(t.startDate).getFullYear() === this.filterYear;
      const countryOk = !this.filterCountry || t.destination === this.filterCountry;
      return yearOk && countryOk;
    });
  }

  get hasActiveFilters(): boolean {
    return this.filterYear !== null || this.filterCountry !== null;
  }

  onYearChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.filterYear = val ? +val : null;
  }

  onCountryChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.filterCountry = val || null;
  }

  clearFilters(): void {
    this.filterYear = null;
    this.filterCountry = null;
  }
  globeLoadState: GlobeLoadState = 'loading-engine';
  countryFeatures: any[] = [];

  private globe: any;
  private sub!: Subscription;
  private leafletRef: any = null;
  private leaflet2d: any = null;
  private markers2d: any[] = [];
  private globeLoadTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private tripService: TripService,
    private router: Router,
    public authService: AuthService,
    public themeService: ThemeService
  ) {}

  async logout(): Promise<void> {
    await this.authService.signOut();
    this.router.navigate(['/login']);
  }

  getEmailShort(email: string): string {
    return email.split('@')[0];
  }

  ngOnInit(): void {
    this.initWeather();
    this.sub = this.tripService.trips$.subscribe(trips => {
      this.trips = trips.sort((a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
      if (this.globe) this.refreshMarkers();
      this.refresh2dMarkers();
    });
  }

  ngAfterViewInit(): void {
    this.init2dMap();
    this.initMap();
    document.addEventListener('viewTrip', this.onViewTripEvent);
    document.addEventListener('viewDest', this.onViewDestEvent);
  }

  ngOnDestroy(): void {
    this.clearGlobeLoadTimeout();
    if (this.globe) {
      this.globe.pauseAnimation?.();
      try { this.globe.renderer().dispose(); } catch {}
      this.globe = null;
    }
    if (this.leaflet2d) {
      this.leaflet2d.remove();
      this.leaflet2d = null;
      this.leafletRef = null;
    }
    clearTimeout(this.labelTimer);
    this.sub?.unsubscribe();
    document.removeEventListener('viewTrip', this.onViewTripEvent);
    document.removeEventListener('viewDest', this.onViewDestEvent);
  }

  private onViewTripEvent = (e: Event) => {
    this.router.navigate(['/trip', (e as CustomEvent).detail]);
  };

  private onViewDestEvent = (e: Event) => {
    const dest = (e as CustomEvent).detail;
    const trip = this.trips.find(t => t.destination === dest);
    if (trip) this.router.navigate(['/trip', trip.id]);
  };

  countryLabel: string = '';
  private labelTimer: any;
  private hoveredCountry: any = null;

  private capColor = (d: any) =>
    d === this.hoveredCountry ? this.cssVar('--tertiary', '#F0ABFC') : this.cssVar('--primary500', '#8B5CF6');

  private sideColor = () => this.cssVar('--primary700', '#854330');

  private strokeColor = () => this.cssVar('--primary700', '#854330');

  private oceanColor = () => this.cssVar('--globe-ocean', '#08262f');

  private createGlobeOceanMaterial(THREE: any) {
    return new THREE.MeshPhongMaterial({
      color: this.oceanColor(),
      opacity: 1,
      shininess: 8,
      transparent: false
    });
  }

  private altitude = (d: any) =>
    d === this.hoveredCountry ? 0.025 : 0.006;

  private cssVar(name: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  get globeLoadingMessage(): string {
    switch (this.globeLoadState) {
      case 'loading-engine': return '載入 3D 地球引擎';
      case 'loading-data': return '載入國界資料';
      case 'rendering': return '建立 3D 地球';
      case 'fallback': return '目前先使用 2D 地圖';
      case 'failed': return '3D 地球暫時無法載入';
      case 'ready': return '';
    }
  }

  get isGlobeLoading(): boolean {
    return this.globeLoadState === 'loading-engine' ||
      this.globeLoadState === 'loading-data' ||
      this.globeLoadState === 'rendering';
  }

  handleGlobeTimeout(): void {
    if (this.globeReady) return;
    this.globeLoadState = 'fallback';
  }

  handleGlobeError(err?: unknown): void {
    if (err) console.error('Globe init failed, 2D map remains:', err);
    if (this.globeReady) return;
    this.globeLoadState = 'failed';
    this.clearGlobeLoadTimeout();
  }

  private async init2dMap(): Promise<void> {
    const L = await import('leaflet');
    this.leafletRef = L;
    if (!this.map2dEl || this.globeReady) return;

    this.leaflet2d = L.map(this.map2dEl.nativeElement, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      keyboard: false,
      doubleClickZoom: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
    }).addTo(this.leaflet2d);

    this.leaflet2d.setView([20, 0], 1.5);
    this.refresh2dMarkers();
  }

  private refresh2dMarkers(): void {
    if (!this.leaflet2d || !this.leafletRef) return;
    const L = this.leafletRef;

    this.markers2d.forEach(m => m.remove());
    this.markers2d = [];

    this.buildTripMapGroups().forEach(group => {
      const icon = L.divIcon({
        className: '',
        html: `<div class="globe-badge">
          <div class="badge-pin"><span class="badge-count">${group.count}</span></div>
          <div class="badge-label">${group.label}</div>
        </div>`,
        iconSize: [60, 52],
        iconAnchor: [10, 36],
      });
      const marker = L.marker([group.lat, group.lng], { icon }).addTo(this.leaflet2d);
      marker.on('click', () => this.openTripGroup(group));
      this.markers2d.push(marker);
    });
  }

  private async initMap(): Promise<void> {
    this.globeLoadState = 'loading-engine';
    this.startGlobeLoadTimeout();

    try {
      const [GlobeLib, THREE] = await Promise.all([
        import('globe.gl'),
        import('three')
      ]);
      const Globe = ((GlobeLib as any).default ?? GlobeLib) as any;

      this.updateGlobeProgress('loading-data');
      const countries = await this.loadCountriesData();
      this.countryFeatures = countries.features ?? [];
      this.refresh2dMarkers();

      // Wait two frames so the container is fully laid out before globe.gl measures it
      await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      if (!this.mapContainer) return;

      this.updateGlobeProgress('rendering');
      this.globe = Globe()(this.mapContainer.nativeElement)
      .globeMaterial(this.createGlobeOceanMaterial(THREE))
      .backgroundColor('rgba(0,0,0,0)')
      .atmosphereColor('#5b9bd5')
      .atmosphereAltitude(0.22)
      .polygonsData(countries.features as any[])
      .polygonCapColor(this.capColor)
      .polygonSideColor(this.sideColor)
      .polygonStrokeColor(this.strokeColor)
      .polygonAltitude(this.altitude)
      .polygonsTransitionDuration(180)
      .onPolygonClick((polygon: any) => {
        if (!polygon) return;
        const name = polygon.properties?.ADMIN || polygon.properties?.name || '';
        if (!name) return;
        clearTimeout(this.labelTimer);
        this.countryLabel = name;
        this.labelTimer = setTimeout(() => { this.countryLabel = ''; }, 2500);
      })
      .onPolygonHover((polygon: any) => {
        this.hoveredCountry = polygon;
        this.globe
          .polygonCapColor(this.capColor)
          .polygonSideColor(this.sideColor)
          .polygonStrokeColor(this.strokeColor)
          .polygonAltitude(this.altitude);
      })
      .htmlElementsData([])
      .htmlElement((d: any) => {
        const el = document.createElement('div');
        el.className = 'globe-badge';
        el.innerHTML = `
          <div class="badge-pin">
            <span class="badge-count">${d.count}</span>
          </div>
          <div class="badge-label">${d.label}</div>
        `;
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => {
          this.openTripGroup(d);
        });
        return el;
      })
      .htmlLat((d: any) => d.lat)
      .htmlLng((d: any) => d.lng)
      .htmlAltitude(0.06)
      .htmlTransitionDuration(300);

      this.globe.controls().autoRotate = true;
      this.globe.controls().autoRotateSpeed = 0.5;
      this.globe.controls().enableDamping = true;
      this.globe.pointOfView({ altitude: 1.8 });

      this.refreshMarkers();

      // Switch from 2D to 3D, then tear down Leaflet
      this.globeReady = true;
      this.globeLoadState = 'ready';
      this.clearGlobeLoadTimeout();
      setTimeout(() => {
        this.leaflet2d?.remove();
        this.leaflet2d = null;
        this.leafletRef = null;
        this.markers2d = [];
      }, 900);
    } catch (err) {
      this.handleGlobeError(err);
    }
  }

  private async loadCountriesData(): Promise<any> {
    const res = await fetch(COUNTRIES_GEOJSON_URL);
    if (!res.ok) throw new Error(`Unable to load ${COUNTRIES_GEOJSON_URL}: ${res.status}`);
    return res.json();
  }

  private startGlobeLoadTimeout(): void {
    this.clearGlobeLoadTimeout();
    this.globeLoadTimeout = setTimeout(() => this.handleGlobeTimeout(), GLOBE_LOAD_TIMEOUT_MS);
  }

  private clearGlobeLoadTimeout(): void {
    if (!this.globeLoadTimeout) return;
    clearTimeout(this.globeLoadTimeout);
    this.globeLoadTimeout = null;
  }

  private updateGlobeProgress(state: GlobeLoadState): void {
    if (this.globeLoadState === 'fallback') return;
    this.globeLoadState = state;
  }

  private refreshMarkers(): void {
    if (!this.globe) return;
    this.globe.htmlElementsData(this.buildTripMapGroups());
  }

  buildTripMapGroups(): TripMapGroup[] {
    const groups = new Map<string, TripMapGroup & { sumLat: number; sumLng: number }>();

    this.trips.filter(t => t.lat != null && t.lng != null).forEach(trip => {
      const countryName = this.findCountryName(trip.lat!, trip.lng!);
      const key = countryName ? `country:${countryName}` : `destination:${trip.destination}`;
      const label = countryName ?? trip.destination;
      const existing = groups.get(key);

      if (existing) {
        existing.count++;
        existing.sumLat += trip.lat!;
        existing.sumLng += trip.lng!;
        existing.lat = existing.sumLat / existing.count;
        existing.lng = existing.sumLng / existing.count;
        existing.tripIds.push(trip.id);
        return;
      }

      groups.set(key, {
        key,
        label,
        count: 1,
        lat: trip.lat!,
        lng: trip.lng!,
        sumLat: trip.lat!,
        sumLng: trip.lng!,
        color: PIN_COLORS[trip.id.charCodeAt(0) % PIN_COLORS.length],
        tripIds: [trip.id]
      });
    });

    return Array.from(groups.values()).map(({ sumLat, sumLng, ...group }) => group);
  }

  private findCountryName(lat: number, lng: number): string | null {
    const feature = this.countryFeatures.find(country => this.featureContainsPoint(country, lat, lng));
    return feature?.properties?.ADMIN ?? feature?.properties?.name ?? null;
  }

  private featureContainsPoint(feature: any, lat: number, lng: number): boolean {
    const geometry = feature?.geometry;
    if (!geometry) return false;

    if (geometry.type === 'Polygon') {
      return this.polygonContainsPoint(geometry.coordinates, lat, lng);
    }

    if (geometry.type === 'MultiPolygon') {
      return geometry.coordinates.some((polygon: number[][][]) =>
        this.polygonContainsPoint(polygon, lat, lng)
      );
    }

    return false;
  }

  private polygonContainsPoint(polygon: number[][][], lat: number, lng: number): boolean {
    if (!polygon?.[0]) return false;
    return this.ringContainsPoint(polygon[0], lat, lng) &&
      !polygon.slice(1).some(ring => this.ringContainsPoint(ring, lat, lng));
  }

  private ringContainsPoint(ring: number[][], lat: number, lng: number): boolean {
    let inside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      const intersects = ((yi > lat) !== (yj > lat)) &&
        (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
      if (intersects) inside = !inside;
    }

    return inside;
  }

  private openTripGroup(group: TripMapGroup): void {
    if (group.tripIds.length === 1) {
      document.dispatchEvent(new CustomEvent('viewTrip', { detail: group.tripIds[0] }));
      return;
    }

    clearTimeout(this.labelTimer);
    this.countryLabel = `${group.label} · ${group.count} 次旅程`;
    this.labelTimer = setTimeout(() => { this.countryLabel = ''; }, 2500);
  }

  viewTrip(tripId: string): void {
    this.router.navigate(['/trip', tripId]);
  }

  editTrip(tripId: string): void {
    this.router.navigate(['/edit-trip', tripId]);
  }

  addNewTrip(): void {
    this.router.navigate(['/add-trip']);
  }

  confirmDelete(trip: Trip): void {
    this.tripToDelete = trip;
  }

  cancelDelete(): void {
    this.tripToDelete = null;
  }

  async executeDelete(): Promise<void> {
    if (!this.tripToDelete) return;
    await this.tripService.deleteTrip(this.tripToDelete.id);
    this.tripToDelete = null;
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' });
  }

  getDuration(startDate: Date, endDate: Date): number {
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }

  private async initWeather(): Promise<void> {
    if (!navigator.geolocation) return;
    this.weatherLoading = true;

    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lon } }) => {
        try {
          const [geoRes, wxRes] = await Promise.all([
            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh-TW`, {
              headers: { 'Accept-Language': 'zh-TW' }
            }),
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,relative_humidity_2m`)
          ]);
          const geo = await geoRes.json();
          const wx = await wxRes.json();
          const addr = geo.address ?? {};
          this.weatherCity = addr.city || addr.town || addr.village || addr.county || addr.state || '';
          this.weatherCountry = addr.country || '';
          this.weatherTemp = Math.round(wx.current.temperature_2m);
          this.weatherCode = wx.current.weather_code;
          this.weatherHumidity = wx.current.relative_humidity_2m;
        } catch {
          this.weatherError = true;
        } finally {
          this.weatherLoading = false;
        }
      },
      () => { this.weatherError = true; this.weatherLoading = false; },
      { timeout: 10000 }
    );
  }

  getWeatherIcon(code: number | null): string {
    if (code === null) return '';
    if (code === 0) return '☀️';
    if (code <= 2) return '🌤️';
    if (code === 3) return '☁️';
    if (code <= 48) return '🌫️';
    if (code <= 55) return '🌦️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '❄️';
    if (code <= 82) return '🌦️';
    return '⛈️';
  }

  getWeatherDesc(code: number | null): string {
    if (code === null) return '';
    if (code === 0) return '晴朗';
    if (code === 1) return '大致晴朗';
    if (code === 2) return '部分多雲';
    if (code === 3) return '陰天';
    if (code <= 48) return '有霧';
    if (code <= 55) return '毛毛雨';
    if (code <= 67) return '雨天';
    if (code <= 77) return '降雪';
    if (code <= 82) return '陣雨';
    return '雷雨';
  }

  getGradient(id: string): string {
    const c = PIN_COLORS[id.charCodeAt(0) % PIN_COLORS.length];
    return c;
  }

  getTotalDays(): number {
    return this.trips.reduce((sum, t) => sum + this.getDuration(t.startDate, t.endDate), 0);
  }

  getTotalActivities(): number {
    return this.trips.reduce((sum, t) => sum + t.activities.length, 0);
  }

  getCompletedCount(trip: Trip): number {
    return trip.activities.filter(a => a.completed).length;
  }
}
