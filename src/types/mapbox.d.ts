// Type declarations for mapbox-gl transitive dependencies
declare module '@mapbox/point-geometry' {
    class Point {
        x: number;
        y: number;
        constructor(x: number, y: number);
    }
    export = Point;
}

declare module '@mapbox/vector-tile' {
    export class VectorTile {
        layers: { [key: string]: VectorTileLayer };
        constructor(pbf: unknown);
    }
    export class VectorTileLayer {
        name: string;
        extent: number;
        length: number;
        feature(i: number): VectorTileFeature;
    }
    export class VectorTileFeature {
        type: number;
        extent: number;
        properties: { [key: string]: string | number | boolean };
        loadGeometry(): Array<Array<{ x: number; y: number }>>;
        toGeoJSON(x: number, y: number, z: number): GeoJSON.Feature;
    }
}
