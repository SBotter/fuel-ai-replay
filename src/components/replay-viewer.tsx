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
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const range = (dataMax - dataMin) || 1;
  const padding = range * 0.1;
  const min = dataMin - padding;
  const max = dataMax + padding;
  const points = values.map((value, idx) => {
    const x = (idx / Math.max(values.length - 1, 1)) * width;
    const y = height - ((value - min) / (max - min)) * height;
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
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [autoFollow, setAutoFollow] = useState(true);
  const [mode, setMode] = useState<ReplayMode>(payload.display.defaultMode);

  useEffect(() => {
    if (!playing) return;
    const intervalMs = 100; // Fixed 10fps for liquid smoothness
    const id = window.setInterval(() => {
      setCurrentIdx((value) => {
        const next = value + Math.round(playbackSpeed);
        if (next >= model.points.length - 1) {
          setPlaying(false);
          return model.points.length - 1;
        }
        return next;
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [playing, model.points.length, playbackSpeed]);

  const point = model.points[currentIdx] ?? model.points[0];
  const relatedInsightIds = new Set(
    payload.insights
      .filter((insight) => insight.sampleIdx === currentIdx || (insight.sampleIdx !== undefined && Math.abs(insight.sampleIdx - currentIdx) < 8))
      .map((insight) => insight.id),
  );

  const maxElev = model.stats.maxElevationM;
  const isAtPeakElev = point.elevationM >= maxElev;
  const currentGain = point.cumulativeGainM;

  const maxSpeed = model.stats.maxSpeedMps;
  const minSpeed = model.stats.minSpeedMps;
  const isAtMaxSpeed = point.speedMps >= maxSpeed;
  const avgSpeedProgress = point.avgSpeedMps;

  const getGradeStyle = (grade: number) => {
    if (grade < 0) return { backgroundColor: 'rgba(34, 197, 94, 0.4)', border: '1px solid rgba(34, 197, 94, 0.5)' };
    if (grade < 5) return { backgroundColor: 'rgba(234, 179, 8, 0.2)', border: '1px solid rgba(234, 179, 8, 0.3)' };
    if (grade < 10) return { backgroundColor: 'rgba(240, 128, 128, 0.4)', border: '1px solid rgba(240, 128, 128, 0.5)' };
    return { backgroundColor: 'rgba(220, 38, 38, 0.6)', border: '1px solid rgba(220, 38, 38, 0.8)' };
  };

  return (
    <main className="page-shell">
      <style>{`
        @keyframes pulse-once {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          50% { transform: scale(1.03); box-shadow: 0 0 20px 5px rgba(239, 68, 68, 0.3); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .peak-glow {
          background-color: rgba(220, 38, 38, 0.6) !important;
          border-color: rgba(255, 255, 255, 0.5) !important;
        }
        .animate-peak {
           animation: pulse-once 1.2s ease-out 1;
        }
      `}</style>
      <div className="replay-layout">
        <section className="card map-panel">
          <div className="map-topbar">
            <div>
              <div className="metric-label">{payload.activity.sportType}</div>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{payload.activity.name}</div>
              <div className="footer-note">{new Date(payload.activity.startDate).toLocaleString()}</div>
            </div>
            <div className="control-row">
              <div className="flex gap-1 bg-black/20 p-1 rounded-lg mr-2">
                {[1, 2, 4].map((s) => (
                  <button 
                    key={s} 
                    onClick={() => setPlaybackSpeed(s)}
                    className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-all ${playbackSpeed === s ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
              <button className={`control-btn ${playing ? '' : 'primary'}`} onClick={() => setPlaying((v) => !v)}>
                {playing ? 'Pause' : 'Play'}
              </button>
              <button className="control-btn" onClick={() => setCurrentIdx(0)}>Start</button>
              <button className="control-btn" onClick={() => setAutoFollow((v) => !v)}>
                {autoFollow ? 'Focus' : 'Orbit'}
              </button>
            </div>
          </div>

          <ReplayMap model={model} mode={mode} currentIdx={currentIdx} autoFollow={autoFollow} playbackSpeed={playbackSpeed} />

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
            <div className={`metric-card transition-all ${isAtMaxSpeed ? 'peak-glow' : ''}`}>
              <div className="flex justify-between items-start">
                <div className="metric-label">Speed</div>
                {isAtMaxSpeed && <div className="text-[9px] font-black uppercase text-white bg-red-600 px-1.5 rounded">Max: {formatSpeed(maxSpeed)}</div>}
              </div>
              <div className="metric-value">{formatSpeed(point.speedMps)}</div>
              <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter flex justify-between">
                <span>Avg: <span className="text-blue-400">{formatSpeed(avgSpeedProgress)}</span></span>
                <span>Min: <span className="text-slate-500">{formatSpeed(minSpeed)}</span></span>
              </div>
            </div>
            <div className="metric-card" style={getGradeStyle(point.gradePct)}>
              <div className="metric-label">Grade</div>
              <div className="metric-value">{point.gradePct.toFixed(1)}%</div>
            </div>
            <div key={point.isPeak ? 'peak' : 'norm'} className={`metric-card transition-all ${point.isPeak ? 'peak-glow animate-peak' : ''}`}>
              <div className="flex justify-between items-start">
                <div className="metric-label">Elevation</div>
                {point.isPeak && <div className="text-[9px] font-black uppercase text-white bg-red-600 px-1.5 rounded shadow-[0_0_10px_rgba(239,68,68,0.5)]">Higher Point: {point.elevationM.toFixed(0)}m</div>}
              </div>
              <div className="metric-value">{point.elevationM.toFixed(0)} m</div>
              <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                Gain: <span className="text-emerald-400">{currentGain}m</span>
              </div>
            </div>
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
