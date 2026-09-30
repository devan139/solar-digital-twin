# Solar Plant Digital Twin — Architecture

![Architecture Diagram](architecture.png)

## Prototype Architecture

```text
┌─────────────────────────────────────┐
│     Solar Plant Sample Dataset      │
│                                     │
│  solar_plant_sample_data.xlsx       │
│  SensorTelemetry + PlantTelemetry   │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│        Python Data Loader            │
│                                     │
│              Pandas                 │
│         Telemetry Validation         │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│       Telemetry Simulator            │
│                                     │
│  • Simulation clock                 │
│  • Dataset progression              │
│  • Demo / realtime modes            │
│  • Scenario injection               │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│       State & Alert Engine           │
│                                     │
│  Temperature thresholds             │
│  NORMAL / WARNING / CRITICAL        │
│  Plant status aggregation           │
│  Alert transition detection         │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│             FastAPI                  │
│                                     │
│  REST API                           │
│  WebSocket                          │
│  Asset / Telemetry / Alert APIs     │
└──────────────────┬──────────────────┘
                   │
                   │ WebSocket
                   ▼
┌─────────────────────────────────────────────────────┐
│                  React Frontend                      │
│                                                     │
│  ┌─────────────────┐     ┌────────────────────────┐ │
│  │ Executive       │     │ Three.js Digital Twin  │ │
│  │ Dashboard       │     │                        │ │
│  │                 │     │ • Solar plant GLB      │ │
│  │ • Power         │     │ • Asset mapping        │ │
│  │ • Avg Temp      │     │ • Selection            │ │
│  │ • Max Temp      │     │ • Status visualization │ │
│  │ • Plant Status  │     │ • Orbit / Zoom / Pan   │ │
│  └─────────────────┘     └────────────────────────┘ │
│                                                     │
│  ┌─────────────────┐     ┌────────────────────────┐ │
│  │ Telemetry       │     │ Operations              │ │
│  │ Charts          │     │                         │ │
│  │                 │     │ • Active Alerts        │ │
│  │ • Power         │     │ • Operational Insight  │ │
│  │ • Temperature   │     │ • Simulated Camera     │ │
│  └─────────────────┘     └────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## Asset Mapping

The physical 3D model and telemetry system share a common asset identifier.

```text
GLB Object              Telemetry Asset

array_01  ────────────► ARRAY_01
array_02  ────────────► ARRAY_02
array_03  ────────────► ARRAY_03
array_04  ────────────► ARRAY_04
array_05  ────────────► ARRAY_05
array_06  ────────────► ARRAY_06
```

Each mapped Three.js object stores:

```javascript
object.userData.assetId = "ARRAY_04";
```

This provides the link between the physical representation and operational telemetry.

---

## Real-Time Data Flow

```text
Telemetry Record
      │
      ▼
Simulator
      │
      ▼
State Evaluation
      │
      ├──────────────► Asset State
      │
      ├──────────────► Plant State
      │
      └──────────────► Alert
                         │
                         ▼
                     WebSocket
                         │
                         ▼
                   React State
                         │
             ┌───────────┼───────────┐
             ▼           ▼           ▼
           3D Twin    Dashboard    Alerts
```

---

## Asset State Evaluation

```text
Panel Temperature
       │
       ▼
┌─────────────────────────┐
│ Temperature < 70°C      │
│        NORMAL           │
└─────────────────────────┘

70°C ≤ Temperature < 75°C
       │
       ▼
┌─────────────────────────┐
│        WARNING          │
└─────────────────────────┘

Temperature ≥ 75°C
       │
       ▼
┌─────────────────────────┐
│        CRITICAL         │
└─────────────────────────┘
```

Plant status is derived from the collection of asset states:

```text
CRITICAL asset exists
        │
        ▼
   Plant CRITICAL

otherwise

WARNING asset exists
        │
        ▼
   Plant WARNING

otherwise

   Plant NORMAL
```

---

## Production Scalability

The prototype data source can be replaced without changing the browser visualization architecture.

```text
                CURRENT PROTOTYPE

Excel Dataset
     │
     ▼
Python Simulator
     │
     ▼
FastAPI
     │
     ▼
WebSocket
     │
     ▼
React + Three.js


                PRODUCTION EVOLUTION

Physical IoT Sensors
        │
        ▼
   MQTT / OPC-UA
        │
        ▼
    IoT Gateway
        │
        ▼
   Message Broker
        │
        ▼
 Telemetry Platform
        │
        ▼
 Time-Series Database
        │
        ▼
 Digital Twin Services
        │
        ├──────────► Web / Three.js
        ├──────────► Unity / XR
        └──────────► OpenUSD / Omniverse
```

The key architectural principle is separation between:

1. **Telemetry source**
2. **Operational state**
3. **Digital asset representation**
4. **Visualization**

This allows the telemetry source to evolve without requiring the digital-twin frontend to be rebuilt.
