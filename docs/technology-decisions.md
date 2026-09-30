# Technology Decisions & Rationale

This document details the technology choices and core architectural decisions for the Solar Plant Digital Twin prototype.

---

## 1. Technology Stack Summary

| Technology | Purpose |
| :--- | :--- |
| **React** | Component-driven operational web application UI |
| **TypeScript** | Type-safe end-to-end frontend development and contracts |
| **Three.js** | Browser-native, hardware-accelerated 3D digital twin |
| **FastAPI** | High-performance asynchronous Python REST and WebSocket backend |
| **Python** | IoT simulation, analytics, and telemetry processing |
| **Pandas** | Efficient time-series dataset ingestion and validation |
| **WebSocket** | Low-latency, bi-directional real-time telemetry streaming |
| **GLTF / GLB** | Standardized, efficient binary 3D asset packaging and delivery |
| **Recharts** | Responsive SVG/canvas operational time-series charting |
| **Rule Engine** | Deterministic thermal threshold evaluation and alert transition detection |

---

## 2. Key Architectural Decisions

### Decision 1: Decoupling Visualization from Telemetry Source
- **Choice**: The frontend consumes standardized telemetry schemas (`PlantTelemetry`, `AssetTelemetry`, `AssetState`, `Alert`) over a generic WebSocket interface.
- **Rationale**: The UI and 3D visual twin have zero coupling to Excel, pandas, or the simulation clock. In a production environment, the simulator can be swapped for an IoT Gateway consuming MQTT or OPC-UA without altering the frontend visualization layer.

### Decision 2: Backend-Driven State Evaluation (Single Source of Truth)
- **Choice**: The backend `StateService` and `PlantStateService` evaluate operational thresholds (`NORMAL`, `WARNING`, `CRITICAL`) and compute aggregated plant health.
- **Rationale**: Prevents frontend/backend logic drift. The digital twin frontend acts as an operational presentation layer, ensuring that state transitions and alerts remain authoritative, auditable, and centralized.

### Decision 3: Explicit Physical-to-Logical Asset Mapping (`userData.assetId`)
- **Choice**: GLB meshes (`array_01` through `array_06`) are tagged on load with `userData.assetId = "ARRAY_0X"`.
- **Rationale**: Decouples 3D model geometry from data processing. 3D artists can rename or restructure sub-meshes in Blender/CAD without breaking telemetry contracts, so long as the designated asset anchors exist.

### Decision 4: Unified Visual State Authority (`applyAssetVisual`)
- **Choice**: A single function controls asset materials with a strict precedence hierarchy: `Selected (Blue) > Critical (Red) > Warning (Amber) > Normal (Original)`.
- **Rationale**: Eliminates race conditions where selection highlights and operational alert colors fight over the same GPU materials, preserving original materials across visual state resets.

### Decision 5: Browser-Native Three.js over Standalone Game Engines
- **Choice**: Three.js runs directly in modern browsers via standard WebGL.
- **Rationale**: Unity or Unreal WebAssembly exports often require large binary downloads (100MB+) and long loading screens. Three.js delivers an instant, lightweight 3D experience directly embedded inside the operational dashboard.

### Decision 6: State-Transition Based Alert Emission
- **Choice**: Alerts are emitted when an asset transitions between states (e.g. `NORMAL` $\rightarrow$ `WARNING` $\rightarrow$ `CRITICAL`), rather than repeatedly firing identical alert records on every 1-second simulation tick.
- **Rationale**: Prevents operator alert fatigue and network flooding while providing a clear chronological alert history.

### Decision 7: Separation of Anomaly Detection from AI Explanation
- **Choice**: Anomaly detection relies on deterministic thermal rules, while the AI Insight component provides operator-facing explanations, potential impacts, and recommended mitigations.
- **Rationale**: In critical infrastructure operations, deterministic rules guarantee safety and predictable behavior, while AI layers provide natural language context and operator guidance without non-deterministic failure modes.
