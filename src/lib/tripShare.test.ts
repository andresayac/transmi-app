import { describe, expect, it } from 'vitest';
import { decodePolyline, encodePolyline, packTrip, toItinerary, unpackTrip } from './tripShare';
import type { ActiveTrip } from '@/stores/app';
import type { LngLat } from './geo';

describe('polyline', () => {
    it('round-trips coordinates at ~1 m precision', () => {
        const coords: LngLat[] = [[-74.06281, 4.64859], [-74.06377, 4.65335], [-74.04576, 4.75513]];
        const back = decodePolyline(encodePolyline(coords));
        expect(back).toHaveLength(3);
        back.forEach(([lng, lat], i) => {
            expect(lng).toBeCloseTo(coords[i][0], 5);
            expect(lat).toBeCloseTo(coords[i][1], 5);
        });
    });

    it('matches the reference encoding of Google\'s algorithm', () => {
        // Example from the polyline algorithm documentation (lat, lng order)
        expect(encodePolyline([[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]])).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    });
});

const trip: ActiveTrip = {
    startedAt: '2026-10-31T23:00:00.000Z',
    from: { name: 'Mi ubicación', lat: 4.6486, lng: -74.0628 },
    to: { name: 'Portal Norte', lat: 4.757, lng: -74.046 },
    itinerary: {
        id: 'it-0',
        durationMin: 48,
        walkMeters: 1200,
        walkMin: 16,
        transfers: 0,
        bounds: null,
        tags: [],
        legs: [
            {
                mode: 'WALK', durationMin: 9, distanceM: 685, distanceText: '685 m',
                from: { id: '', code: '', name: 'Mi ubicación', lat: 4.6486, lng: -74.0628 },
                to: { id: '', code: '', name: 'Flores B - 4 ó 6-T', lat: 4.65335, lng: -74.06377 },
                geometry: [[-74.0628, 4.6486], [-74.06377, 4.65335]],
            },
            {
                mode: 'TRANSIT', durationMin: 31, distanceM: 12000, distanceText: '12 km',
                from: { id: '1', code: 'X', name: 'Flores B - 4 ó 6-T', lat: 4.65335, lng: -74.06377 },
                to: { id: '2', code: 'Y', name: 'Portal Norte T5A', lat: 4.75385, lng: -74.04636 },
                geometry: [[-74.06377, 4.65335], [-74.0597, 4.6718], [-74.04636, 4.75385]],
                line: { id: '12814', code: 'B13', name: 'B13', longName: 'Portal Norte', color: '#80BA27', agency: 'Transmilenio-Troncal', kind: 'troncal' },
                stops: [],
            },
        ],
    },
};

describe('packTrip / unpackTrip', () => {
    it('round-trips what the follower page needs', () => {
        const packed = packTrip(trip, { currentLeg: 1, etaMs: Date.parse('2026-10-31T23:48:00Z'), bus: 'A10072', by: 'Andrés' });
        expect(packed).toMatch(/^[A-Za-z0-9_-]+$/); // URL-safe
        const back = unpackTrip(packed)!;
        expect(back.by).toBe('Andrés');
        expect(back.bus).toBe('A10072');
        expect(back.cur).toBe(1);
        expect(back.to[0]).toBe('Portal Norte');
        expect(back.legs[1]).toMatchObject({ m: 'T', c: 'B13', n: 'Portal Norte', k: '#80BA27', d: 31 });

        const { itinerary, to } = toItinerary(back);
        expect(to.name).toBe('Portal Norte');
        expect(itinerary.legs[1].line?.code).toBe('B13');
        expect(itinerary.legs[1].geometry.length).toBeGreaterThanOrEqual(2);
        expect(itinerary.durationMin).toBe(40);
    });

    it('rejects links that were cut or tampered with', () => {
        expect(unpackTrip('not-a-trip')).toBeNull();
        expect(unpackTrip(packTrip(trip, { currentLeg: 0, etaMs: 0 }).slice(0, 30))).toBeNull();
    });
});
