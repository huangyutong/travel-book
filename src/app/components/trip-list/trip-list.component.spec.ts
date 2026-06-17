import { TripListComponent } from './trip-list.component';
import { Trip } from '../../models/trip.model';

describe('TripListComponent', () => {
  let component: TripListComponent;

  beforeEach(() => {
    component = new TripListComponent(
      { trips$: { subscribe: () => ({ unsubscribe: () => {} }) }, deleteTrip: async () => {} } as any,
      { navigate: () => {} } as any,
      { user$: {} } as any,
      { isDark: false, toggle: () => {} } as any
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts with a 3D engine loading state', () => {
    expect(component.globeLoadState).toBe('loading-engine');
    expect(component.globeLoadingMessage).toBe('載入 3D 地球引擎');
  });

  it('keeps the 2D fallback visible when globe loading times out', () => {
    component.handleGlobeTimeout();

    expect(component.globeReady).toBeFalse();
    expect(component.globeLoadState).toBe('fallback');
    expect(component.globeLoadingMessage).toBe('目前先使用 2D 地圖');
  });

  it('keeps the 2D fallback visible when globe loading fails', () => {
    component.handleGlobeError();

    expect(component.globeReady).toBeFalse();
    expect(component.globeLoadState).toBe('failed');
    expect(component.globeLoadingMessage).toBe('3D 地球暫時無法載入');
  });

  it('groups trips in the same country into one map marker', () => {
    component.countryFeatures = [
      {
        type: 'Feature',
        properties: { ADMIN: 'Testland' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [119, 21], [123, 21], [123, 26], [119, 26], [119, 21]
          ]]
        }
      }
    ];
    component.trips = [
      createTrip('taipei', 'Taipei', 25.03, 121.56),
      createTrip('kaohsiung', 'Kaohsiung', 22.62, 120.30)
    ];

    const groups = component.buildTripMapGroups();

    expect(groups.length).toBe(1);
    expect(groups[0].label).toBe('Testland');
    expect(groups[0].count).toBe(2);
    expect(groups[0].tripIds).toEqual(['taipei', 'kaohsiung']);
  });

  it('falls back to destination grouping when a trip is outside known countries', () => {
    component.countryFeatures = [];
    component.trips = [
      createTrip('tokyo', 'Tokyo', 35.68, 139.76)
    ];

    const groups = component.buildTripMapGroups();

    expect(groups.length).toBe(1);
    expect(groups[0].label).toBe('Tokyo');
    expect(groups[0].count).toBe(1);
    expect(groups[0].tripIds).toEqual(['tokyo']);
  });

  it('uses primary300 for globe land blocks and primary on hover', () => {
    const hoveredCountry = { id: 'hovered' };
    spyOn(window, 'getComputedStyle').and.returnValue({
      getPropertyValue: (name: string) => {
        if (name === '--primary') return ' #ff4501 ';
        if (name === '--primary300') return ' #e07454 ';
        return '';
      }
    } as CSSStyleDeclaration);

    expect((component as any).capColor({})).toBe('#e07454');
    (component as any).hoveredCountry = hoveredCountry;
    expect((component as any).capColor(hoveredCountry)).toBe('#ff4501');
  });

  it('uses primary700 for globe land sides and stroke lines', () => {
    spyOn(window, 'getComputedStyle').and.returnValue({
      getPropertyValue: (name: string) => name === '--primary700' ? ' #854330 ' : ''
    } as CSSStyleDeclaration);

    expect((component as any).sideColor()).toBe('#854330');
    expect((component as any).strokeColor()).toBe('#854330');
  });

  it('creates an opaque tokenized globe ocean material', () => {
    spyOn(window, 'getComputedStyle').and.returnValue({
      getPropertyValue: (name: string) => name === '--globe-ocean' ? ' #08262f ' : ''
    } as CSSStyleDeclaration);
    let materialParams: any;
    class MeshPhongMaterial {
      params: any;

      constructor(params: any) {
        this.params = params;
        materialParams = params;
      }
    }

    const material = (component as any).createGlobeOceanMaterial({ MeshPhongMaterial });

    expect(materialParams).toEqual(jasmine.objectContaining({
      color: '#08262f',
      opacity: 1,
      transparent: false
    }));
    expect(material.params.color).toBe('#08262f');
  });
});

function createTrip(id: string, destination: string, lat: number, lng: number): Trip {
  return {
    id,
    destination,
    lat,
    lng,
    title: `${destination} trip`,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-02'),
    activities: [],
    expenses: []
  };
}
