import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { TelemetrySocket } from "./services/telemetrySocket";
import { ASSET_METADATA } from "./telemetry/assets";
import type {
  Alert,
  ConnectionState,
  PlantTelemetry,
  TelemetryMessage,
} from "./telemetry/types";
import SolarPlantScene from "./twin/SolarPlantScene";
import { KpiCards } from "./dashboard/KpiCards";
import { TwinWorkspace } from "./dashboard/TwinWorkspace";
import { AssetHealthTable } from "./dashboard/AssetHealthTable";
import { PlantCharts } from "./dashboard/PlantCharts";
import { AlertCenter } from "./alerts/AlertCenter";
import { AIInsight } from "./alerts/AIInsight";
import { PlantCamera } from "./camera/PlantCamera";
import { SystemDiagnostics } from "./dashboard/SystemDiagnostics";
import { SystemOverview } from "./dashboard/SystemOverview";

function App() {
  const [activeView, setActiveView] = useState<"twin" | "overview">(() => {
    if (typeof window !== "undefined" && window.location.hash === "#overview") {
      return "overview";
    }
    return "twin";
  });

  const handleSelectView = (view: "twin" | "overview") => {
    setActiveView(view);
    if (typeof window !== "undefined") {
      window.location.hash = view === "overview" ? "overview" : "twin";
    }
  };

  const [telemetry, setTelemetry] =
    useState<TelemetryMessage | null>(null);

  const [plantHistory, setPlantHistory] =
    useState<PlantTelemetry[]>([]);

  const [connected, setConnected] =
    useState(false);

  const [connectionState, setConnectionState] =
    useState<ConnectionState>("DISCONNECTED");

  const [selectedAssetId, setSelectedAssetId] =
    useState<string | null>(null);

  const [plantModel, setPlantModel] =
    useState<THREE.Object3D | null>(null);

  const [alertHistory, setAlertHistory] =
    useState<Alert[]>([]);

  // Telemetry tick observation
  const [tickIntervalMs, setTickIntervalMs] =
    useState<number | null>(null);
  const [lastReceiptTime, setLastReceiptTime] =
    useState<number | null>(null);
  const [secondsSinceLastTick, setSecondsSinceLastTick] =
    useState<number | null>(null);

  const recentReceiptTimesRef = useRef<number[]>([]);

  // Live timer for elapsed seconds since last receipt
  useEffect(() => {
    const timer = setInterval(() => {
      if (lastReceiptTime && connected) {
        setSecondsSinceLastTick(
          Math.max(0, Math.floor((Date.now() - lastReceiptTime) / 1000)),
        );
      } else {
        setSecondsSinceLastTick(null);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [lastReceiptTime, connected]);

  // Keyboard accessibility and hash change listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "1") {
        e.preventDefault();
        handleSelectView("twin");
      } else if (e.altKey && e.key === "2") {
        e.preventDefault();
        handleSelectView("overview");
      } else if (e.key === "Escape" && activeView === "overview") {
        e.preventDefault();
        handleSelectView("twin");
      }
    };

    const handleHashChange = () => {
      if (window.location.hash === "#overview") {
        setActiveView("overview");
      } else if (window.location.hash === "#twin" || window.location.hash === "") {
        setActiveView("twin");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [activeView]);

  useEffect(() => {
    const socket = new TelemetrySocket();

    socket.connect(
      (message) => {
        const now = performance.now();
        setLastReceiptTime(Date.now());

        // Derive tick cadence from actual server delivery receipts
        const times = recentReceiptTimesRef.current;
        times.push(now);
        if (times.length > 8) {
          times.shift();
        }
        if (times.length >= 2) {
          const intervals: number[] = [];
          for (let i = 1; i < times.length; i++) {
            intervals.push(times[i] - times[i - 1]);
          }
          const avg =
            intervals.reduce((a, b) => a + b, 0) / intervals.length;
          setTickIntervalMs(avg);
        }

        setTelemetry(message);

        setPlantHistory((previous) => [
          ...previous,
          message.plant,
        ].slice(-60));

        if (message.alerts && message.alerts.length > 0) {
          setAlertHistory((previous) => {
            const combined = [
              ...previous,
              ...message.alerts,
            ];

            const unique = Array.from(
              new Map(
                combined.map((alert) => [
                  alert.id,
                  alert,
                ]),
              ).values(),
            );

            return unique.slice(-20);
          });
        }
      },
      (status) => {
        setConnected(status);
        if (!status) {
          recentReceiptTimesRef.current = [];
          setTickIntervalMs(null);
          setSecondsSinceLastTick(null);
        }
      },
      (state) => {
        setConnectionState(state);
      },
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  const selectedAsset =
    telemetry?.assets.find(
      (asset) =>
        asset.asset_id === selectedAssetId,
    );

  const selectedAssetState =
    telemetry?.states.find(
      (state) =>
        state.asset_id === selectedAssetId,
    );

  const selectedMetadata =
    selectedAssetId
      ? ASSET_METADATA[selectedAssetId]
      : undefined;

  const selectedHealth =
    selectedAssetId
      ? telemetry?.health?.assets?.[selectedAssetId]
      : undefined;


  const latestAlert =
    alertHistory.length > 0
      ? alertHistory[alertHistory.length - 1]
      : undefined;

  const freshAssetsCount =
    connected && telemetry?.states
      ? telemetry.states.filter((s) => s.data_condition === "FRESH").length
      : 0;

  const staleAssetsCount =
    connected && telemetry?.states
      ? telemetry.states.filter((s) => s.data_condition === "STALE").length
      : 0;

  const unavailAssetsCount = connected
    ? 6 - (freshAssetsCount + staleAssetsCount)
    : 6;

  const plantDataHealth =
    telemetry?.health?.plant_data_health ??
    telemetry?.plant?.data_health ??
    (connected ? "UNKNOWN" : "DISCONNECTED");

  const simulatorStatus =
    telemetry?.health?.simulator_status ?? (connected ? "RUNNING" : "UNKNOWN");

  const plantEquipmentCondition =
    telemetry?.health?.plant_equipment_condition ??
    telemetry?.plant?.plant_status ??
    (connected ? "NORMAL" : "UNKNOWN");

  const isPlantStale = plantDataHealth === "DEGRADED" || staleAssetsCount > 0;

  return (
    <div className="app-shell">
      {/* 1. Industrial Operational Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-logo-mark">
            <span className="brand-icon">◈</span>
          </div>
          <div>
            <h1 className="brand-title">
              SOLAR<span className="brand-slash">//</span>TWIN
            </h1>
            <p className="brand-subtitle">
              Facility 01 &bull; Real-Time Solar Plant Operations
            </p>
          </div>
        </div>

        {/* View Switcher: Operations Twin vs System Overview */}
        <nav className="header-view-nav" role="tablist" aria-label="Dashboard Views">
          <button
            type="button"
            role="tab"
            id="tab-twin"
            aria-selected={activeView === "twin"}
            aria-controls="view-twin"
            tabIndex={activeView === "twin" ? 0 : -1}
            className={`view-nav-tab ${activeView === "twin" ? "active" : ""}`}
            onClick={() => handleSelectView("twin")}
          >
            <span className="tab-icon">⊞</span>
            <span>Operations Twin</span>
          </button>
          <button
            type="button"
            role="tab"
            id="tab-overview"
            aria-selected={activeView === "overview"}
            aria-controls="view-overview"
            tabIndex={activeView === "overview" ? 0 : -1}
            className={`view-nav-tab ${activeView === "overview" ? "active" : ""}`}
            onClick={() => handleSelectView("overview")}
          >
            <span className="tab-icon">⎇</span>
            <span>System Overview</span>
            <span className="tab-chip">Arch</span>
          </button>
        </nav>

        <div className="header-status-cluster">
          {/* Explicit Simulated Telemetry Indicator */}
          <div className="status-badge demo-badge" title="Telemetry is generated by physical simulator engine">
            <span className="badge-icon">⚑</span>
            <span>SIMULATED DATA</span>
          </div>

          {/* WebSocket Reconnection Status */}
          <div
            className={`status-badge live-status ${
              connectionState === "CONNECTED"
                ? "live"
                : connectionState === "RECONNECTING"
                ? "reconnecting"
                : "offline"
            }`}
          >
            <span className="pulse-indicator" />
            <span>
              {connectionState === "CONNECTED"
                ? "● LIVE"
                : connectionState === "RECONNECTING"
                ? "↻ RECONNECTING"
                : "○ DISCONNECTED"}
            </span>
          </div>

          {/* Simulator Task Health */}
          <div
            className={`status-badge sim-badge status-${simulatorStatus.toLowerCase()}`}
          >
            <span className="badge-icon">⚙</span>
            <span>SIM: {simulatorStatus}</span>
          </div>

          {/* Plant Equipment Condition */}
          <div
            className={`status-badge equip-status-badge condition-${plantEquipmentCondition.toLowerCase()}`}
          >
            <span className="badge-icon">⚡</span>
            <span>EQUIP: {plantEquipmentCondition}</span>
          </div>

          {/* Plant Data Health Condition */}
          <div
            className={`status-badge data-status-badge ${
              plantDataHealth === "HEALTHY"
                ? "healthy"
                : plantDataHealth === "DEGRADED"
                ? "degraded"
                : "offline"
            }`}
          >
            <span className="badge-icon">◉</span>
            <span>DATA: {connected ? plantDataHealth : "OFFLINE"}</span>
          </div>

          {/* Freshness Cadence Ticker */}
          <div className="status-badge ticker-badge">
            <span className="badge-icon">⏱</span>
            <span>
              {secondsSinceLastTick !== null
                ? `TICK: ${secondsSinceLastTick}s AGO`
                : "TICK: —"}
            </span>
          </div>
        </div>
      </header>

      <main
        id="view-twin"
        role="tabpanel"
        aria-labelledby="tab-twin"
        className="app-main"
        style={{ display: activeView === "twin" ? "flex" : "none" }}
      >
        {/* 2. Executive KPI Strip */}
        <KpiCards
          plant={telemetry?.plant ?? null}
          freshCount={freshAssetsCount}
          totalAssets={6}
          dataHealth={plantDataHealth}
          isStale={isPlantStale}
        />

        {/* 3. Primary 3D Digital Twin Workspace */}
        <TwinWorkspace
          selectedAsset={selectedAsset}
          selectedAssetState={selectedAssetState}
          selectedMetadata={selectedMetadata}
          validationError={selectedHealth?.last_error}
          onClearSelection={() => setSelectedAssetId(null)}
        >
          <SolarPlantScene
            assetStates={telemetry?.states ?? []}
            selectedAssetId={selectedAssetId}
            selectedAsset={selectedAsset}
            selectedAssetState={selectedAssetState}
            selectedMetadata={selectedMetadata}
            onAssetSelect={setSelectedAssetId}
            onModelLoaded={setPlantModel}
          />
        </TwinWorkspace>

        {/* 4. Asset Telemetry & Freshness Fleet Table */}
        <AssetHealthTable
          assets={telemetry?.assets ?? []}
          assetStates={telemetry?.states ?? []}
          systemHealth={telemetry?.health}
          selectedAssetId={selectedAssetId}
          onSelectAsset={setSelectedAssetId}
          connected={connected}
        />

        {/* 5. Telemetry Trends Buffer */}
        <PlantCharts history={plantHistory} />

        {/* 6. Operations & Diagnostics Deck */}
        <div className="operations-grid">
          <AlertCenter alerts={alertHistory} />
          <AIInsight alert={latestAlert} />
          <PlantCamera
            model={plantModel}
            timestamp={telemetry?.plant.timestamp}
          />
          <SystemDiagnostics
            connectionState={connectionState}
            simulatorStatus={telemetry?.health?.simulator_status}
            tickIntervalMs={tickIntervalMs}
            lastTickTime={telemetry?.timestamp ?? null}
            freshCount={freshAssetsCount}
            staleCount={staleAssetsCount}
            unavailCount={unavailAssetsCount}
            onViewOverview={() => handleSelectView("overview")}
          />
        </div>
      </main>

      {/* System Architecture Overview Panel */}
      <div
        id="view-overview"
        role="tabpanel"
        aria-labelledby="tab-overview"
        style={{ display: activeView === "overview" ? "block" : "none" }}
      >
        <SystemOverview
          connectionState={connectionState}
          connected={connected}
          simulatorStatus={simulatorStatus}
          plantEquipmentCondition={plantEquipmentCondition}
          plantDataHealth={plantDataHealth}
          freshCount={freshAssetsCount}
          staleCount={staleAssetsCount}
          unavailCount={unavailAssetsCount}
          tickIntervalMs={tickIntervalMs}
          secondsSinceLastTick={secondsSinceLastTick}
          telemetry={telemetry}
          plantModelLoaded={plantModel !== null}
          selectedAssetId={selectedAssetId}
          alerts={alertHistory}
          onSelectAsset={setSelectedAssetId}
          onSwitchToTwin={() => handleSelectView("twin")}
        />
      </div>
    </div>
  );
}

export default App;
