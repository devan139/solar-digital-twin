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

  return (
    <main>
      <header>
        <div>
          <h1>Solar Plant Digital Twin</h1>
          <p>Operations Dashboard</p>
        </div>

        <div>
          {connected ? "● LIVE" : "○ DISCONNECTED"}
        </div>
      </header>

      <KpiCards
        plant={
          telemetry?.plant ?? null
        }
      />

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

      <AlertCenter alerts={alertHistory} />

      <AIInsight alert={latestAlert} />

      <PlantCamera model={plantModel} />
    </main>
  );
}

export default App;
