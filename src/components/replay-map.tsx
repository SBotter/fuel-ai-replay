'use client';

import { useEffect, useMemo, useRef } from 'react';
import mapboxgl, { GeoJSONSource, LngLatBoundsLike, Map } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getModeColor, type NormalizedReplayModel } from '@/lib/normalize';
import type { ReplayMode } from '@/lib/replay-payload';

const TERRAIN_SOURCE_ID = 'terrain-dem';
const ROUTE_SOURCE_ID = 'route-segments';
const POINT_SOURCE_ID = 'current-point';

function buildRouteSegments(model: NormalizedReplayModel, mode: ReplayMode) {
  const features = [] as GeoJSON.Feature<GeoJSON.LineString, { color: string; idx: number; played: boolean }>[];
  for (let i = 1; i < model.points.length; i += 1) {
    const prev = model.points[i - 1];
    const current = model.points[i];
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [prev.lon, prev.lat],
          [current.lon, current.lat],
        ],
      },
      properties: {
        color: getModeColor(current, mode),
        idx: i,
        played: false,
      },
    });
  }
  return { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection;
}

export function ReplayMap({
  model,
  mode,
  currentIdx,
  autoFollow,
}: {
  model: NormalizedReplayModel;
  mode: ReplayMode;
  currentIdx: number;
  autoFollow: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const currentPoint = model.points[Math.max(0, Math.min(currentIdx, model.points.length - 1))];

  const routeGeoJson = useMemo(() => buildRouteSegments(model, mode), [model, mode]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!accessToken) return;

    mapboxgl.accessToken = accessToken;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [currentPoint.lon, currentPoint.lat],
      zoom: model.payload.display.initialZoom,
      pitch: model.payload.display.initialPitch,
      bearing: model.payload.display.initialBearing,
      antialias: true,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');

    map.on('style.load', () => {
      map.addSource(TERRAIN_SOURCE_ID, {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });
      map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1.35 });
      map.setFog({ color: 'rgb(5, 15, 35)', 'high-color': 'rgb(11, 31, 66)', 'space-color': 'rgb(3, 11, 24)' });

      map.addSource(ROUTE_SOURCE_ID, { type: 'geojson', data: routeGeoJson });
      map.addLayer({
        id: 'route-glow',
        type: 'line',
        source: ROUTE_SOURCE_ID,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 10,
          'line-opacity': 0.18,
        },
      });
      map.addLayer({
        id: 'route-main',
        type: 'line',
        source: ROUTE_SOURCE_ID,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 5,
          'line-opacity': 0.95,
        },
      });

      map.addSource(POINT_SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [currentPoint.lon, currentPoint.lat] },
              properties: {},
            },
          ],
        },
      });
      map.addLayer({
        id: 'current-point',
        type: 'circle',
        source: POINT_SOURCE_ID,
        paint: {
          'circle-radius': 8,
          'circle-color': '#ff5b0a',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });

      map.fitBounds(model.bounds as LngLatBoundsLike, { padding: 40, duration: 0 });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [accessToken, currentPoint.lat, currentPoint.lon, model]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource | undefined;
    if (source) {
      source.setData(routeGeoJson);
    }
  }, [routeGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const pointSource = map.getSource(POINT_SOURCE_ID) as GeoJSONSource | undefined;
    if (pointSource) {
      pointSource.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [currentPoint.lon, currentPoint.lat] },
            properties: {},
          },
        ],
      });
    }

    if (autoFollow) {
      const next = model.points[Math.min(currentIdx + 8, model.points.length - 1)] ?? currentPoint;
      const bearing = Math.atan2(next.lon - currentPoint.lon, next.lat - currentPoint.lat) * 180 / Math.PI;
      map.easeTo({
        center: [currentPoint.lon, currentPoint.lat],
        bearing: Number.isFinite(bearing) ? bearing : map.getBearing(),
        pitch: model.payload.display.initialPitch,
        duration: 220,
        essential: true,
      });
    }
  }, [autoFollow, currentIdx, currentPoint, model]);

  if (!accessToken) {
    return (
      <div className="map-canvas" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="card" style={{ padding: 24, maxWidth: 520 }}>
          <strong>Mapbox token missing.</strong>
          <p className="footer-note" style={{ marginTop: 8 }}>
            Set <code>NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> in Vercel or your local <code>.env.local</code> to enable the full 3D map.
          </p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="map-canvas" />;
}
