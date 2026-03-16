'use client';

import { useEffect, useMemo, useState } from 'react';
import { normalizeReplayPayload, type NormalizedReplayModel } from '@/lib/normalize';
import { ReplayMap } from '@/components/replay-map';
import type { ReplayMode, ReplayPayload } from '@/lib/replay-payload';

function formatDistance(distanceM: number) {
  return `${(distanceM / 1000).toFixed(1)} km`;
}
function formatSpeed(speedMps: number) {
  return `${(speedMps * 3.6).toFixed(1)} km/h`;
}
function formatTime(totalS: number) {
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
}
function severityClass(severity: string | undefined) {
  return severity === 'critical' ? 'critical' : severity === 'warning' ? 'warning' : 'info';
}

function Sparkline({ values, color, currentIndex }: { values: number[]; color: string; currentIndex: number }) {
  const width = 680;
  const height = 120;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const points = values.map((value, idx) => {
    const x = (idx / Math.max(values.length - 1, 1)) * width;
    const y = height - ((value - min) / ((max - min) || 1)) * (height - 14) - 7;
    return `${x},${y}`;
  }).join(' ');
  const cursorX = (currentIndex / Math.max(values.length - 1, 1)) * width;

  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="3" points={points} />
      <line x1={cursorX} x2={cursorX} y1={0} y2={height} stroke="rgba(255,255,255,.45)" strokeDasharray="4 4" />
    </svg>
  );
}

export function ReplayViewer({ payload }: { payload: ReplayPayload }) {
  const model: NormalizedReplayModel = useMemo(() => normalizeReplayPayload(payload), [payload]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [mode, setMode] = useState<ReplayMode>(payload.display.defaultMode);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setCurrentIdx((value) => {
        if (value >= model.points.length - 1) {
          setPlaying(false);
          return value;
        }
        return value + 1;
      });
    }, 120);
    return () => window.clearInterval(id);
  }, [playing, model.points.length]);

  const point = model.points[currentIdx] ?? model.points[0];
  const relatedInsightIds = new Set(
    payload.insights
      .filter((insight) => insight.sampleIdx === currentIdx || (insight.sampleIdx !== undefined && Math.abs(insight.sampleIdx - currentIdx) < 8))
      .map((insight) => insight.id),
  );

  return (
    <main className="page-shell">
      <div className="replay-layout">
        <section className="card map-panel">
          <div className="map-topbar">
            <div>
              <div className="metric-label">{payload.activity.sportType}</div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{payload.activity.name}</div>
              <div className="footer-note">{new Date(payload.activity.startDate).toLocaleString()}</div>
            </div>
            <div className="control-row">
              <button className={`control-btn ${playing ? '' : 'primary'}`} onClick={() => setPlaying((v) => !v)}>
                {playing ? 'Pause' : 'Play'}
              </button>
              <button className="control-btn" onClick={() => setCurrentIdx(0)}>Start</button>
              <button className="control-btn" onClick={() => setAutoFollow((v) => !v)}>
                {autoFollow ? 'Auto camera on' : 'Auto camera off'}
              </button>
            </div>
          </div>

          <ReplayMap model={model} mode={mode} currentIdx={currentIdx} autoFollow={autoFollow} />

          <div style={{ padding: '14px 18px 0' }}>
            <input
              className="scrubber"
              type="range"
              min={0}
              max={model.points.length - 1}
              value={currentIdx}
              onChange={(e) => setCurrentIdx(Number(e.target.value))}
            />
            <div className="footer-note">
              {formatTime(point.elapsedS)} elapsed · {formatDistance(point.distanceM)} covered
            </div>
          </div>

          <div className="metrics-row">
            <div className="metric-card"><div className="metric-label">Speed</div><div className="metric-value">{formatSpeed(point.speedMps)}</div></div>
            <div className="metric-card"><div className="metric-label">Grade</div><div className="metric-value">{point.gradePct.toFixed(1)}%</div></div>
            <div className="metric-card"><div className="metric-label">Elevation</div><div className="metric-value">{point.elevationM.toFixed(0)} m</div></div>
            <div className="metric-card"><div className="metric-label">Fuel risk</div><div className="metric-value">{Math.round(point.fuelRisk * 100)}%</div></div>
            <div className="metric-card"><div className="metric-label">Glycogen left</div><div className="metric-value">{point.glycogenRemainingG?.toFixed(0) ?? '—'} g</div></div>
          </div>
        </section>

        <aside className="side-column">
          <section className="card side-section">
            <h3>Overlay mode</h3>
            <div className="mode-row">
              {payload.display.availableModes.map((availableMode) => (
                <button
                  key={availableMode}
                  className={`mode-btn ${mode === availableMode ? 'active' : ''}`}
                  onClick={() => setMode(availableMode)}
                >
                  {availableMode}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 14 }} className="legend">
              <span>Low</span>
              <div className="legend-bar" />
              <span>High</span>
            </div>
          </section>

          <section className="card side-section">
            <h3>Charts</h3>
            <div className="chart-wrap">
              <div>
                <div className="metric-label">Elevation</div>
                <Sparkline values={model.points.map((p) => p.elevationM)} color="#60a5fa" currentIndex={currentIdx} />
              </div>
              <div>
                <div className="metric-label">Speed</div>
                <Sparkline values={model.points.map((p) => p.speedMps * 3.6)} color="#f97316" currentIndex={currentIdx} />
              </div>
              <div>
                <div className="metric-label">Fuel risk</div>
                <Sparkline values={model.points.map((p) => p.fuelRisk * 100)} color="#ef4444" currentIndex={currentIdx} />
              </div>
            </div>
          </section>

          <section className="card side-section">
            <h3>Hotspots</h3>
            <div className="segment-list">
              {payload.segments.map((segment) => (
                <div key={segment.id} className="segment-item">
                  <button onClick={() => setCurrentIdx(segment.startIdx)}>
                    <span className={`tag ${severityClass(segment.severity)}`}>{segment.type}</span>
                    <div className="item-title">{segment.title}</div>
                    {segment.summary ? <div className="item-summary">{segment.summary}</div> : null}
                    <div className="mini-metrics">
                      {Object.entries(segment.metrics).slice(0, 4).map(([key, value]) => (
                        <span key={key}>{key}: {String(value)}</span>
                      ))}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="card side-section">
            <h3>Insights</h3>
            <div className="insight-list">
              {payload.insights.map((insight) => (
                <div key={insight.id} className="insight-item" style={{ outline: relatedInsightIds.has(insight.id) ? '1px solid rgba(255,91,10,.8)' : 'none' }}>
                  <span className={`tag ${severityClass(insight.severity)}`}>{insight.type}</span>
                  <div className="item-title">{insight.title}</div>
                  <div className="item-summary">{insight.description}</div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
