import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type {
  AssetState,
  AssetStatus,
  AssetTelemetry,
} from "../telemetry/types";
import type { AssetMetadata } from "../telemetry/assets";

function applyAssetVisual(
  object: THREE.Object3D,
  status: AssetStatus,
  selected: boolean,
  hovered: boolean,
) {
  object.traverse((child) => {
    if (child.type !== "Mesh") {
      return;
    }

    const mesh = child as THREE.Mesh;

    if (!mesh.userData.originalMaterial) {
      mesh.userData.originalMaterial = mesh.material;
      const orig = mesh.material as THREE.MeshStandardMaterial;
      if (orig && orig.map) {
        mesh.userData.panelMap = orig.map;
      }
    }

    const panelMap = mesh.userData.panelMap;

    if (selected) {
      if (!mesh.userData.selectedMat) {
        mesh.userData.selectedMat = new THREE.MeshStandardMaterial({
          color: 0x101b22,
          map: panelMap || null,
          emissive: 0x095260,
          emissiveIntensity: 0.48,
          roughness: 0.22,
          metalness: 0.42,
        });
      }
      mesh.material = mesh.userData.selectedMat;
      return;
    }

    if (status === "CRITICAL") {
      if (!mesh.userData.criticalMat) {
        mesh.userData.criticalMat = new THREE.MeshStandardMaterial({
          color: 0x2e1414,
          map: panelMap || null,
          emissive: 0xff5c5c,
          emissiveIntensity: hovered ? 0.7 : 0.45,
          roughness: 0.26,
          metalness: 0.3,
        });
      } else {
        mesh.userData.criticalMat.emissiveIntensity = hovered ? 0.7 : 0.45;
      }
      mesh.material = mesh.userData.criticalMat;
      return;
    }

    if (status === "WARNING") {
      if (!mesh.userData.warningMat) {
        mesh.userData.warningMat = new THREE.MeshStandardMaterial({
          color: 0x2e220a,
          map: panelMap || null,
          emissive: 0xf4b942,
          emissiveIntensity: hovered ? 0.65 : 0.4,
          roughness: 0.26,
          metalness: 0.3,
        });
      } else {
        mesh.userData.warningMat.emissiveIntensity = hovered ? 0.65 : 0.4;
      }
      mesh.material = mesh.userData.warningMat;
      return;
    }

    // NORMAL (Hovered state)
    if (hovered) {
      if (!mesh.userData.hoverMat) {
        mesh.userData.hoverMat = new THREE.MeshStandardMaterial({
          color: 0x13252a,
          map: panelMap || null,
          emissive: 0x093339,
          emissiveIntensity: 0.32,
          roughness: 0.22,
          metalness: 0.4,
        });
      }
      mesh.material = mesh.userData.hoverMat;
      return;
    }

    // NORMAL state: Dark photovoltaic glass, graphite, cell texture preserved, subtle teal/blue-green reflection
    if (!mesh.userData.photovoltaicMat) {
      mesh.userData.photovoltaicMat = new THREE.MeshStandardMaterial({
        color: 0x0f181c,
        map: panelMap || null,
        emissive: 0x071e22,
        emissiveIntensity: 0.18,
        roughness: 0.18,
        metalness: 0.46,
      });
    }
    mesh.material = mesh.userData.photovoltaicMat;
  });
}

const ASSET_IDS = [
  "ARRAY_01",
  "ARRAY_02",
  "ARRAY_03",
  "ARRAY_04",
  "ARRAY_05",
  "ARRAY_06",
];

interface SolarPlantSceneProps {
  assetStates: AssetState[];
  selectedAssetId?: string | null;
  selectedAsset?: AssetTelemetry;
  selectedAssetState?: AssetState;
  selectedMetadata?: AssetMetadata;
  onAssetSelect?: (assetId: string | null) => void;
  onModelLoaded?: (model: THREE.Object3D) => void;
}

export default function SolarPlantScene({
  assetStates,
  selectedAssetId: controlledSelectedAssetId,
  selectedAsset,
  selectedAssetState,
  selectedMetadata,
  onAssetSelect,
  onModelLoaded,
}: SolarPlantSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const assetObjectMap = useRef(new Map<string, THREE.Object3D>());

  const [assetsReady, setAssetsReady] = useState(false);
  const [internalSelectedAssetId, setInternalSelectedAssetId] =
    useState<string | null>(null);

  const selectedAssetId =
    controlledSelectedAssetId !== undefined
      ? controlledSelectedAssetId
      : internalSelectedAssetId;

  const setSelectedAssetId = (id: string | null) => {
    setInternalSelectedAssetId(id);
    onAssetSelectRef.current?.(id);
  };

  const assetStatesRef = useRef(assetStates);
  useEffect(() => {
    assetStatesRef.current = assetStates;
  }, [assetStates]);

  const onModelLoadedRef = useRef(onModelLoaded);
  useEffect(() => {
    onModelLoadedRef.current = onModelLoaded;
  }, [onModelLoaded]);

  const onAssetSelectRef = useRef(onAssetSelect);
  useEffect(() => {
    onAssetSelectRef.current = onAssetSelect;
  }, [onAssetSelect]);

  const selectedAssetIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedAssetIdRef.current = selectedAssetId;
  }, [selectedAssetId]);

  const hoveredAssetIdRef = useRef<string | null>(null);

  // Secondary Inspection Camera tracking & state
  const secondaryCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const secondaryTargetPosRef = useRef(new THREE.Vector3(5.4, 3.8, 4.9));
  const secondaryTargetLookRef = useRef(new THREE.Vector3(1.45, 0.65, -0.15));
  const currentSecondaryPosRef = useRef(new THREE.Vector3(5.4, 3.8, 4.9));
  const currentSecondaryLookRef = useRef(new THREE.Vector3(1.45, 0.65, -0.15));
  const secondaryInitializedRef = useRef(false);
  const insetViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!assetsReady || !selectedAssetId) {
      return;
    }

    const object = assetObjectMap.current.get(selectedAssetId);
    if (!object) {
      return;
    }

    object.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(object);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z, 0.8);
    // Inspection distance showing panel surface, cell lines, and immediate mounting context
    const distance = Math.max(maxDim * 1.5, 1.8);
    // Elevated 3/4 inspection angle
    const targetPos = new THREE.Vector3(
      center.x + distance * 0.72,
      center.y + distance * 0.65,
      center.z + distance * 0.78,
    );
    const targetLook = center.clone();

    secondaryTargetPosRef.current.copy(targetPos);
    secondaryTargetLookRef.current.copy(targetLook);

    if (!secondaryInitializedRef.current) {
      currentSecondaryPosRef.current.copy(targetPos).add(new THREE.Vector3(0.5, 0.4, 0.5));
      currentSecondaryLookRef.current.copy(targetLook);
      secondaryInitializedRef.current = true;
    }
  }, [selectedAssetId, assetsReady]);

  useEffect(() => {
    if (!assetsReady) {
      return;
    }

    for (const assetId of ASSET_IDS) {
      const object = assetObjectMap.current.get(assetId);
      if (!object) {
        continue;
      }

      const assetState = assetStates.find((s) => s.asset_id === assetId);
      const status = assetState ? assetState.status : "NORMAL";
      const isSelected = assetId === selectedAssetId;
      const isHovered = assetId === hoveredAssetIdRef.current;

      applyAssetVisual(
        object,
        status,
        isSelected,
        isHovered,
      );
    }
  }, [assetStates, assetsReady, selectedAssetId]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x071014);

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );

    // Target is centered on the facility volume with upward vertical framing compensation
    const plantCenter = new THREE.Vector3(1.45, 0.65, -0.15);
    camera.position.set(5.4, 3.8, 4.9);
    camera.lookAt(plantCenter);

    // Secondary Inspection Camera for Live Panel Detail inset
    const secondaryCamera = new THREE.PerspectiveCamera(36, 16 / 10, 0.1, 500);
    secondaryCamera.position.copy(currentSecondaryPosRef.current);
    secondaryCamera.lookAt(currentSecondaryLookRef.current);
    secondaryCameraRef.current = secondaryCamera;

    const modelGroup = new THREE.Group();
    modelGroup.name = "SuppliedSolarPlantModel";
    scene.add(modelGroup);

    const assetObjects: THREE.Object3D[] = [];

    const loader = new GLTFLoader();

    loader.load(
      `${import.meta.env.BASE_URL}models/solar_energy_for_shopping_malls.glb`,
      (gltf) => {
        const model = gltf.scene;
        onModelLoadedRef.current?.(model);
        model.name = "SolarPlantGLB";
        modelGroup.add(model);

        const assetIds = [
          "ARRAY_01",
          "ARRAY_02",
          "ARRAY_03",
          "ARRAY_04",
          "ARRAY_05",
          "ARRAY_06",
        ];

        for (const assetId of assetIds) {
          const objectName = assetId.toLowerCase();
          const assetObject = model.getObjectByName(objectName);

          if (assetObject) {
            assetObject.userData.assetId = assetId;
            assetObjects.push(assetObject);
            assetObjectMap.current.set(assetId, assetObject);
          }
        }

        // Hide oversized terrain mesh from GLB so facility stands out crisply
        model.traverse((object) => {
          if (object.type !== "Mesh") {
            return;
          }
          const mesh = object as THREE.Mesh;
          const box = new THREE.Box3().setFromObject(mesh);
          const size = box.getSize(new THREE.Vector3());
          if (size.x > 30 || size.z > 30) {
            mesh.visible = false;
          }
        });

        setAssetsReady(true);
      },
      undefined,
      (error) => {
        console.error("Failed to load solar plant model:", error);
      },
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);

    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.minDistance = 3.5;
    controls.maxDistance = 25;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.target.copy(plantCenter);
    controls.autoRotate = false;
    controls.autoRotateSpeed = 1.4; // Extremely slow: ~43s per 360° revolution
    controls.update();

    // Respect reduced-motion accessibility preference
    const motionMediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let prefersReducedMotion = motionMediaQuery.matches;

    const IDLE_DELAY_MS = 5000;
    let idleTimer: number | null = null;
    let isInteracting = false;

    const clearIdleTimer = () => {
      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const startIdleTimer = () => {
      clearIdleTimer();
      if (prefersReducedMotion || isInteracting) {
        return;
      }
      idleTimer = window.setTimeout(() => {
        if (!isInteracting && !prefersReducedMotion) {
          controls.autoRotate = true;
        }
      }, IDLE_DELAY_MS);
    };

    const handleInteractionStart = () => {
      isInteracting = true;
      controls.autoRotate = false;
      clearIdleTimer();
    };

    const handleInteractionEnd = () => {
      isInteracting = false;
      startIdleTimer();
    };

    const handleMotionPreferenceChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
      if (prefersReducedMotion) {
        controls.autoRotate = false;
        clearIdleTimer();
      } else {
        startIdleTimer();
      }
    };

    motionMediaQuery.addEventListener("change", handleMotionPreferenceChange);
    controls.addEventListener("start", handleInteractionStart);
    controls.addEventListener("end", handleInteractionEnd);

    const handleWheel = () => {
      controls.autoRotate = false;
      startIdleTimer();
    };
    renderer.domElement.addEventListener("wheel", handleWheel, { passive: true });

    const handleWindowPointerUp = () => {
      if (isInteracting) {
        handleInteractionEnd();
      }
    };
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerUp);

    // Initial idle countdown on mount
    startIdleTimer();

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const handlePointerDown = (event: PointerEvent) => {
      handleInteractionStart();
      pointerDownPos = { x: event.clientX, y: event.clientY };
    };

    const handlePointerUp = (event: PointerEvent) => {
      const dx = event.clientX - pointerDownPos.x;
      const dy = event.clientY - pointerDownPos.y;
      const isDrag = dx * dx + dy * dy > 36; // 6px movement threshold for orbit/pan drag

      if (isDrag) {
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

      raycaster.setFromCamera(mouse, camera);
      const intersections = raycaster.intersectObjects(assetObjects, true);

      // CLICKED ON EMPTY BACKGROUND: Deselect active asset and reset visual
      if (intersections.length === 0) {
        if (selectedAssetIdRef.current) {
          const prevId = selectedAssetIdRef.current;
          selectedAssetIdRef.current = null;
          setSelectedAssetId(null);

          const prevObj = assetObjectMap.current.get(prevId);
          const prevState = assetStatesRef.current.find(
            (s) => s.asset_id === prevId,
          );
          if (prevObj) {
            applyAssetVisual(
              prevObj,
              prevState ? prevState.status : "NORMAL",
              false,
              hoveredAssetIdRef.current === prevId,
            );
          }
        }
        return;
      }

      let object: THREE.Object3D | null = intersections[0].object;
      while (object && !object.userData.assetId && object.parent) {
        object = object.parent;
      }

      const assetId = object?.userData.assetId;
      if (!assetId || !object) {
        if (selectedAssetIdRef.current) {
          const prevId = selectedAssetIdRef.current;
          selectedAssetIdRef.current = null;
          setSelectedAssetId(null);

          const prevObj = assetObjectMap.current.get(prevId);
          const prevState = assetStatesRef.current.find(
            (s) => s.asset_id === prevId,
          );
          if (prevObj) {
            applyAssetVisual(
              prevObj,
              prevState ? prevState.status : "NORMAL",
              false,
              hoveredAssetIdRef.current === prevId,
            );
          }
        }
        return;
      }

      // CLICKED ALREADY SELECTED ASSET: Toggle to deselect and reset blue color
      if (selectedAssetIdRef.current === assetId) {
        selectedAssetIdRef.current = null;
        setSelectedAssetId(null);

        const currentState = assetStatesRef.current.find(
          (state) => state.asset_id === assetId,
        );
        applyAssetVisual(
          object,
          currentState ? currentState.status : "NORMAL",
          false,
          true,
        );
        return;
      }

      // CLICKED A DIFFERENT ASSET: Reset previous selected asset visual first
      const prevId = selectedAssetIdRef.current;
      if (prevId) {
        const prevObj = assetObjectMap.current.get(prevId);
        const prevState = assetStatesRef.current.find(
          (s) => s.asset_id === prevId,
        );
        if (prevObj) {
          applyAssetVisual(
            prevObj,
            prevState ? prevState.status : "NORMAL",
            false,
            hoveredAssetIdRef.current === prevId,
          );
        }
      }

      // Select newly clicked asset
      selectedAssetIdRef.current = assetId;
      setSelectedAssetId(assetId);

      const currentState = assetStatesRef.current.find(
        (state) => state.asset_id === assetId,
      );

      applyAssetVisual(
        object,
        currentState ? currentState.status : "NORMAL",
        true,
        false,
      );
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

      raycaster.setFromCamera(mouse, camera);
      const intersections = raycaster.intersectObjects(assetObjects, true);

      let newHoveredId: string | null = null;
      if (intersections.length > 0) {
        let object: THREE.Object3D | null = intersections[0].object;
        while (object && !object.userData.assetId && object.parent) {
          object = object.parent;
        }
        if (object && object.userData.assetId) {
          newHoveredId = object.userData.assetId;
        }
      }

      renderer.domElement.style.cursor = newHoveredId ? "pointer" : "default";

      if (newHoveredId !== hoveredAssetIdRef.current) {
        const prevHoveredId = hoveredAssetIdRef.current;
        hoveredAssetIdRef.current = newHoveredId;

        if (prevHoveredId && prevHoveredId !== selectedAssetIdRef.current) {
          const prevObj = assetObjectMap.current.get(prevHoveredId);
          const prevState = assetStatesRef.current.find(
            (s) => s.asset_id === prevHoveredId,
          );
          if (prevObj) {
            applyAssetVisual(
              prevObj,
              prevState ? prevState.status : "NORMAL",
              false,
              false,
            );
          }
        }

        if (newHoveredId && newHoveredId !== selectedAssetIdRef.current) {
          const newObj = assetObjectMap.current.get(newHoveredId);
          const newState = assetStatesRef.current.find(
            (s) => s.asset_id === newHoveredId,
          );
          if (newObj) {
            applyAssetVisual(
              newObj,
              newState ? newState.status : "NORMAL",
              false,
              true,
            );
          }
        }
      }
    };

    const handlePointerLeave = () => {
      if (hoveredAssetIdRef.current) {
        const prevId = hoveredAssetIdRef.current;
        hoveredAssetIdRef.current = null;
        renderer.domElement.style.cursor = "default";
        if (prevId !== selectedAssetIdRef.current) {
          const prevObj = assetObjectMap.current.get(prevId);
          const prevState = assetStatesRef.current.find(
            (s) => s.asset_id === prevId,
          );
          if (prevObj) {
            applyAssetVisual(
              prevObj,
              prevState ? prevState.status : "NORMAL",
              false,
              false,
            );
          }
        }
      }
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);

    // Balanced Cinematic Lighting setup
    const ambientLight = new THREE.AmbientLight(0xcfe4e8, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff6e5, 1.45);
    keyLight.position.set(9, 16, 7);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x63909d, 0.45);
    fillLight.position.set(-8, 9, -5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x35d0e6, 0.35);
    rimLight.position.set(-4, 5, -8);
    scene.add(rimLight);

    // Ground plane matching site dimensions
    const groundGeometry = new THREE.PlaneGeometry(16, 16);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x071014,
      roughness: 0.95,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(1.5, -0.05, -0.2);
    scene.add(ground);

    // Subtle Site Boundary outline
    const boundaryGeometry = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(10.5, 0.06, 11.0),
    );
    const boundaryMaterial = new THREE.LineBasicMaterial({
      color: 0x20373c,
      transparent: true,
      opacity: 0.5,
    });
    const boundary = new THREE.LineSegments(boundaryGeometry, boundaryMaterial);
    boundary.position.set(1.5, 0.0, -0.2);
    scene.add(boundary);

    // Subtle Architectural Spatial Grid
    const grid = new THREE.GridHelper(16, 16, 0x102b2b, 0x0d1b20);
    grid.position.set(1.5, -0.04, -0.2);
    scene.add(grid);

    const clock = new THREE.Clock();
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      controls.update(delta);

      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;

      // 1. Primary main digital-twin camera rendering
      renderer.setViewport(0, 0, containerWidth, containerHeight);
      renderer.setScissorTest(false);
      renderer.render(scene, camera);

      // 2. Secondary inspection camera rendering (if asset selected & inset viewport mounted)
      const currentSelectedId = selectedAssetIdRef.current;
      const secondaryCam = secondaryCameraRef.current;
      const insetEl = insetViewportRef.current;

      if (currentSelectedId && secondaryCam && insetEl) {
        const viewportRect = insetEl.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        const insetW = Math.round(viewportRect.width);
        const insetH = Math.round(viewportRect.height);
        const insetX = Math.round(viewportRect.left - containerRect.left);
        const insetY = Math.round(containerRect.bottom - viewportRect.bottom);

        // Render secondary view only if inset has valid dimensions
        if (insetW > 10 && insetH > 10) {
          secondaryCam.aspect = insetW / insetH;
          secondaryCam.updateProjectionMatrix();

          // Smooth exponential damping toward current target asset
          const lerpFactor = 1 - Math.exp(-6.5 * delta);
          currentSecondaryPosRef.current.lerp(
            secondaryTargetPosRef.current,
            lerpFactor,
          );
          currentSecondaryLookRef.current.lerp(
            secondaryTargetLookRef.current,
            lerpFactor,
          );
          secondaryCam.position.copy(currentSecondaryPosRef.current);
          secondaryCam.lookAt(currentSecondaryLookRef.current);

          // Configure scissor & viewport for inset inspection region
          renderer.setScissorTest(true);
          renderer.setScissor(insetX, insetY, insetW, insetH);
          renderer.setViewport(insetX, insetY, insetW, insetH);

          // Clear depth buffer to prevent Z-fighting with main scene
          renderer.clearDepth();
          renderer.render(scene, secondaryCam);

          // Restore renderer state
          renderer.setScissorTest(false);
          renderer.setViewport(0, 0, containerWidth, containerHeight);
        }
      }
    };

    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      clearIdleTimer();
      cancelAnimationFrame(animationFrameId);
      motionMediaQuery.removeEventListener("change", handleMotionPreferenceChange);
      controls.removeEventListener("start", handleInteractionStart);
      controls.removeEventListener("end", handleInteractionEnd);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerUp);
      renderer.domElement.removeEventListener("wheel", handleWheel);

      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);

      secondaryCameraRef.current = null;
      controls.dispose();
      renderer.dispose();

      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }

      groundGeometry.dispose();
      groundMaterial.dispose();
      boundaryGeometry.dispose();
      boundaryMaterial.dispose();
    };
  }, []);

  const currentStatus =
    selectedAssetState?.status ??
    (selectedAsset ? selectedAsset.status : "NORMAL");

  return (
    <div
      ref={containerRef}
      className="solar-plant-scene"
      style={{
        width: "100%",
        height: "620px",
        position: "relative",
      }}
    >
      {/* Three.js main canvas mounts here via containerRef */}

      {/* Live Panel Detail Inset */}
      <div
        className={`twin-inset-card ${
          selectedAssetId ? "has-selection" : "is-idle"
        }`}
        aria-label="Solar Array Inspection Inset"
      >
        <div className="twin-inset-header">
          <div className="twin-inset-title-group">
            <span
              className={`twin-inset-status-dot ${
                selectedAssetId ? `status-${currentStatus.toLowerCase()}` : ""
              }`}
            />
            <span className="twin-inset-live-badge">
              {selectedAssetId ? "LIVE PANEL DETAIL" : "PANEL DETAIL"}
            </span>
            {selectedAssetId && (
              <span className="twin-inset-asset-id">{selectedAssetId}</span>
            )}
          </div>
          {selectedAssetId && onAssetSelect && (
            <button
              type="button"
              className="twin-inset-close-btn"
              onClick={() => setSelectedAssetId(null)}
              title="Close Inspection View"
              aria-label="Close Inspection View"
            >
              ✕
            </button>
          )}
        </div>

        <div ref={insetViewportRef} className="twin-inset-viewport">
          {selectedAssetId ? (
            <div className="twin-inset-hud-reticle">
              <span className="hud-corner top-left" />
              <span className="hud-corner top-right" />
              <span className="hud-corner bottom-left" />
              <span className="hud-corner bottom-right" />
              <span className="hud-feed-label">CAM-02 // CLOSE-UP</span>
            </div>
          ) : (
            <div className="twin-inset-idle-message">
              <span className="idle-reticle-icon">⌖</span>
              <span className="idle-title">PANEL DETAIL</span>
              <span className="idle-subtitle">Select an array to inspect</span>
            </div>
          )}
        </div>

        <div className="twin-inset-footer">
          {selectedAssetId ? (
            <>
              <span
                className="twin-inset-name"
                title={selectedMetadata?.displayName || selectedAssetId}
              >
                {selectedMetadata?.displayName || selectedAssetId}
              </span>
              <div className="twin-inset-metrics">
                <span
                  className={`twin-inset-status-pill status-${currentStatus.toLowerCase()}`}
                >
                  {currentStatus}
                </span>
                {selectedAsset && (
                  <span className="twin-inset-temp">
                    {selectedAsset.panel_temperature_c.toFixed(1)} °C
                  </span>
                )}
              </div>
            </>
          ) : (
            <span className="twin-inset-idle-hint">STANDBY // SELECT ARRAY</span>
          )}
        </div>
      </div>
    </div>
  );
}
