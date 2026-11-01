import { describe, expect, it } from 'vitest';
import { fitToBox, formatDistance, haversine, orderAlongLine, parseCoord, projectOnPath, simplify, type LngLat } from './geo';
import { colorForRouteCode, readableOn, visibleOnMap } from './color';
import { conventionAppliesTo, formatClock, parseClock } from './schedule';

describe('geo', () => {
    it('measures distances in meters', () => {
        // Calle 72 → Calle 100 on the Autonorte is roughly 2.9 km
        const d = haversine({ lat: 4.6585, lng: -74.061 }, { lat: 4.6840, lng: -74.0577 });
        expect(d).toBeGreaterThan(2700);
        expect(d).toBeLessThan(3000);
    });

    it('parses the API "lat,lng" strings and rejects junk', () => {
        expect(parseCoord('4.65853,-74.06103')).toEqual({ lat: 4.65853, lng: -74.06103 });
        expect(parseCoord('0,0')).toBeNull();
        expect(parseCoord('')).toBeNull();
    });

    it('formats distances for people', () => {
        expect(formatDistance(432)).toBe('430 m');
        expect(formatDistance(2350)).toBe('2.4 km');
    });

    it('projects a point onto a path as a fractional stop index', () => {
        const path = [{ lat: 4.60, lng: -74.08 }, { lat: 4.62, lng: -74.08 }, { lat: 4.64, lng: -74.08 }];
        const { index, offset } = projectOnPath({ lat: 4.63, lng: -74.0801 }, path);
        expect(index).toBeCloseTo(1.5, 1);
        expect(offset).toBeLessThan(20);
    });

    it('simplifies straight runs but keeps corners', () => {
        const line: LngLat[] = [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1]];
        expect(simplify(line, 0.01)).toEqual([[0, 0], [1, 0], [1, 1]]);
    });

    it('orders alphabetical stations along their corridor, north to south', () => {
        const stations = [
            { name: 'Calle 100', lat: 4.684, lng: -74.057 },
            { name: 'Calle 127', lat: 4.704, lng: -74.054 },
            { name: 'Calle 85', lat: 4.672, lng: -74.060 },
            { name: 'Portal Norte', lat: 4.755, lng: -74.046 },
            { name: 'Calle 146', lat: 4.731, lng: -74.050 },
        ];
        expect(orderAlongLine(stations, (s) => s).map((s) => s.name)).toEqual(['Portal Norte', 'Calle 146', 'Calle 127', 'Calle 100', 'Calle 85']);
    });

    it('fits a route into a box with north up, centered inside the padding', () => {
        // A north-south line: it should span the full inner height, centered horizontally
        const line: LngLat[] = [[-74.06, 4.60], [-74.06, 4.70]];
        const project = fitToBox(line, 300, 400, { top: 50, right: 20, bottom: 50, left: 20 });
        const [x1, y1] = project(line[0]);
        const [x2, y2] = project(line[1]);
        expect(y1).toBeCloseTo(350); // south at the bottom
        expect(y2).toBeCloseTo(50);
        expect(x1).toBeCloseTo(150);
        expect(x2).toBeCloseTo(150);
    });
});

describe('color', () => {
    it('chooses readable text on route colors', () => {
        expect(readableOn('#FCBD1B')).toBe('#000000'); // troncal C yellow
        expect(readableOn('#26358C')).toBe('#ffffff'); // troncal A blue
    });

    it('infers troncal colors from route codes', () => {
        expect(colorForRouteCode('B13')).toBe('#80BA27');
        expect(colorForRouteCode('K23', '#D5B079')).toBe('#D5B079');
        expect(colorForRouteCode('591')).toBe('#00618E'); // zonal blue
    });

    it('keeps near-black routes visible on dark maps', () => {
        expect(visibleOnMap('#000000', true)).not.toBe('#000000');
        expect(visibleOnMap('#80BA27', true)).toBe('#80BA27');
    });
});

describe('schedule', () => {
    it('parses 12h and 24h clock strings', () => {
        expect(parseClock('4:30 AM')).toBe(270);
        expect(parseClock('11:00 PM')).toBe(1380);
        expect(parseClock('12:15 AM')).toBe(15);
        expect(formatClock('5:30 PM')).toBe('17:30');
    });

    it('knows which days each convention covers', () => {
        expect(conventionAppliesTo('L-V', 3)).toBe(true);
        expect(conventionAppliesTo('L-V', 6)).toBe(false);
        expect(conventionAppliesTo('L-S', 6)).toBe(true);
        expect(conventionAppliesTo('D-F', 0)).toBe(true);
        expect(conventionAppliesTo('D-F', 2)).toBe(false);
    });
});
