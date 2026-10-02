import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { AssetState, AssetStatus } from "../telemetry/types";

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
          color: 0x38bdf8,
          map: panelMap || null,
          emissive: 0x0284c7,
          emissiveIntensity: 0.65,
          roughness: 0.22,
          metalness: 0.35,
        });
      }
      mesh.material = mesh.userData.selectedMat;
      return;
    }

    if (status === "CRITICAL") {
      if (!mesh.userData.criticalMat) {
        mesh.userData.criticalMat = new THREE.MeshStandardMaterial({
          color: 0xef4444,
          map: panelMap || null,
          emissive: 0x991b1b,
          emissiveIntensity: hovered ? 0.75 : 0.5,
          roughness: 0.28,
          metalness: 0.2,
        });
      } else {
        mesh.userData.criticalMat.emissiveIntensity = hovered ? 0.75 : 0.5;
      }
      mesh.material = mesh.userData.criticalMat;
      return;
    }

    if (status === "WARNING") {
      if (!mesh.userData.warningMat) {
        mesh.userData.warningMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          map: panelMap || null,
          emissive: 0xb45309,
          emissiveIntensity: hovered ? 0.65 : 0.45,
          roughness: 0.3,
          metalness: 0.2,
        });
      } else {
        mesh.userData.warningMat.emissiveIntensity = hovered ? 0.65 : 0.45;
      }
      mesh.material = mesh.userData.warningMat;
      return;
    }

    // NORMAL
    if (hovered) {
      if (!mesh.userData.hoverMat) {
        mesh.userData.hoverMat = new THREE.MeshStandardMaterial({
          color: 0x243b55,
          map: panelMap || null,
          emissive: 0x0e2f50,
          emissiveIntensity: 0.4,
          roughness: 0.24,
          metalness: 0.35,
        });
      }
      mesh.material = mesh.userData.hoverMat;
      return;
    }

    // High-quality photovoltaic normal surface (dark silicon, glass sheen, clear cell segmentation)
    if (!mesh.userData.photovoltaicMat) {
      mesh.userData.photovoltaicMat = new THREE.MeshStandardMaterial({
        color: 0x182434,
        map: panelMap || null,
        emissive: 0x02070e,
        emissiveIntensity: 0.1,
        roughness: 0.22,
        metalness: 0.38,
      });
    }
    mesh.material = mesh.userData.photovoltaicMat;
  });
}

interface SolarPlantSceneProps {
  assetStates: AssetState[];
  onAssetSelect?: (assetId: string | null) => void;
  onModelLoaded?: (model: THREE.Object3D) => void;
}

export default function SolarPlantScene({
  assetStates,
  onAssetSelect,
  onModelLoaded,
}: SolarPlantSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const assetObjectMap = useRef(new Map<string, THREE.Object3D>());

  const [assetsReady, setAssetsReady] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!assetsReady) {
      return;
    }

    for (const assetState of assetStates) {
      const object = assetObjectMap.current.get(assetState.asset_id);
      if (!object) {
        continue;
      }

      const isSelected = assetState.asset_id === selectedAssetId;
      const isHovered = assetState.asset_id === hoveredAssetIdRef.current;

      applyAssetVisual(
        object,
        assetState.status,
        isSelected,
        isHovered,
      );
    }
  }, [assetStates, assetsReady, selectedAssetId]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d12);

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
    controls.update();

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

      raycaster.setFromCamera(mouse, camera);
      const intersections = raycaster.intersectObjects(assetObjects, true);

      if (intersections.length === 0) {
        return;
      }

      let object: THREE.Object3D | null = intersections[0].object;
      while (object && !object.userData.assetId && object.parent) {
        object = object.parent;
      }

      const assetId = object?.userData.assetId;
      if (!assetId || !object) {
        return;
      }

      setSelectedAssetId(assetId);
      onAssetSelectRef.current?.(assetId);

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
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);

    // Balanced Cinematic Lighting setup
    const ambientLight = new THREE.AmbientLight(0xd0dce8, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff8ee, 1.5);
    keyLight.position.set(9, 16, 7);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7ea2c6, 0.45);
    fillLight.position.set(-8, 9, -5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.35);
    rimLight.position.set(-4, 5, -8);
    scene.add(rimLight);

    // Ground plane matching site dimensions
    const groundGeometry = new THREE.PlaneGeometry(16, 16);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x090e15,
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
      color: 0x223244,
      transparent: true,
      opacity: 0.45,
    });
    const boundary = new THREE.LineSegments(boundaryGeometry, boundaryMaterial);
    boundary.position.set(1.5, 0.0, -0.2);
    scene.add(boundary);

    // Subtle Architectural Spatial Grid
    const grid = new THREE.GridHelper(16, 16, 0x182432, 0x0f1620);
    grid.position.set(1.5, -0.04, -0.2);
    scene.add(grid);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
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
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);

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

  return (
    <div
      ref={containerRef}
      className="solar-plant-scene"
      style={{
        width: "100%",
        height: "620px",
      }}
    />
  );
}
