import { useEffect, useState } from "react";
import * as THREE from "three";

import { TelemetrySocket } from "./services/telemetrySocket";
import { ASSET_METADATA } from "./telemetry/assets";
import type { Alert, PlantTelemetry, TelemetryMessage } from "./telemetry/types";
import SolarPlantScene from "./twin/SolarPlantScene";
import { KpiCards } from "./dashboard/KpiCards";
import { TwinWorkspace } from "./dashboard/TwinWorkspace";
import { PlantCharts } from "./dashboard/PlantCharts";
import { AlertCenter } from "./alerts/AlertCenter";
import { AIInsight } from "./alerts/AIInsight";
import { PlantCamera } from "./camera/PlantCamera";

function App() {
  const [telemetry, setTelemetry] =
    useState<TelemetryMessage | null>(null);

  const [plantHistory, setPlantHistory] =
    useState<PlantTelemetry[]>([]);

  const [connected, setConnected] =
    useState(false);

  const [selectedAssetId, setSelectedAssetId] =
    useState<string | null>(null);

  const [plantModel, setPlantModel] =
    useState<THREE.Object3D | null>(null);

  const [alertHistory, setAlertHistory] =
    useState<Alert[]>([]);

  useEffect(() => {
    const socket = new TelemetrySocket();

    socket.connect(
      (message) => {
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

  const latestAlert =
    alertHistory.length > 0
      ? alertHistory[alertHistory.length - 1]
      : undefined;

  const onlineAssetsCount = connected
    ? telemetry?.assets.length ?? 6
    : 0;

  return (
    <div className="app-shell">
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
              Real-Time Solar Plant Operations
            </p>
          </div>
        </div>

        <div className="header-status-cluster">
          <div
            className={`status-badge live-status ${
              connected ? "live" : "offline"
            }`}
          >
            <span className="pulse-indicator" />
            <span>{connected ? "● LIVE" : "○ DISCONNECTED"}</span>
          </div>

          <div className="status-badge asset-status-badge">
            <span className="badge-icon">⬢</span>
            <span>{onlineAssetsCount} ASSETS ONLINE</span>
          </div>

          <div
            className={`status-badge ws-status ${
              connected ? "connected" : "disconnected"
            }`}
          >
            <span className="badge-icon">⚡</span>
            <span>
              {connected
                ? "WEBSOCKET CONNECTED"
                : "WEBSOCKET DISCONNECTED"}
            </span>
          </div>
        </div>
      </header>

      <main className="app-main">
        <KpiCards plant={telemetry?.plant ?? null} />

        <TwinWorkspace
          selectedAsset={selectedAsset}
          selectedAssetState={selectedAssetState}
          selectedMetadata={selectedMetadata}
        >
          <SolarPlantScene
            assetStates={telemetry?.states ?? []}
            onAssetSelect={setSelectedAssetId}
            onModelLoaded={setPlantModel}
          />
        </TwinWorkspace>

        <PlantCharts history={plantHistory} />

        <div className="operations-grid">
          <AlertCenter alerts={alertHistory} />
          <AIInsight alert={latestAlert} />
          <PlantCamera model={plantModel} />
        </div>
      </main>
    </div>
  );
}

export default App;
