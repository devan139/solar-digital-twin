import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { AssetState, AssetStatus } from "../telemetry/types";

const selectionMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x075985,
    emissiveIntensity: 0.45,
    roughness: 0.4,
    metalness: 0.25,
  });

const warningMaterial =
  new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0x78350f,
    emissiveIntensity: 0.35,
    roughness: 0.45,
    metalness: 0.25,
  });

const criticalMaterial =
  new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0x7f1d1d,
    emissiveIntensity: 0.35,
    roughness: 0.45,
    metalness: 0.25,
  });

function applyAssetVisual(
  object: THREE.Object3D,
  status: AssetStatus,
  selected: boolean,
) {
  object.traverse((child) => {
    if (child.type !== "Mesh") {
      return;
    }

    const mesh = child as THREE.Mesh;

    if (!mesh.userData.originalMaterial) {
      mesh.userData.originalMaterial =
        mesh.material;
    }

    if (selected) {
      mesh.material = selectionMaterial;
      return;
    }

    if (status === "CRITICAL") {
      mesh.material = criticalMaterial;
      return;
    }

    if (status === "WARNING") {
      mesh.material = warningMaterial;
      return;
    }

    mesh.material =
      mesh.userData.originalMaterial;
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
  const assetObjectMap = useRef(
    new Map<string, THREE.Object3D>(),
  );

  const [assetsReady, setAssetsReady] = useState(false);
  const [selectedAssetId, setSelectedAssetId] =
    useState<string | null>(null);

  const assetStatesRef = useRef(assetStates);
  useEffect(() => {
    assetStatesRef.current = assetStates;
  }, [assetStates]);

  useEffect(() => {
    if (!assetsReady) {
      return;
    }

    for (const assetState of assetStates) {
      const object =
        assetObjectMap.current.get(
          assetState.asset_id,
        );

      if (!object) {
        continue;
      }

      applyAssetVisual(
        object,
        assetState.status,
        assetState.asset_id === selectedAssetId,
      );
    }
  }, [assetStates, assetsReady, selectedAssetId]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f14);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );

    camera.position.set(7, 6, 8);
    camera.lookAt(1.5, 0.3, 0);

    const modelGroup = new THREE.Group();
    modelGroup.name = "SuppliedSolarPlantModel";
    scene.add(modelGroup);

    const assetObjects: THREE.Object3D[] = [];

    const loader = new GLTFLoader();

    loader.load(
      "/models/solar_energy_for_shopping_malls.glb",
      (gltf) => {
        const model = gltf.scene;

        onModelLoaded?.(model);

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

          const assetObject =
            model.getObjectByName(objectName);

          if (assetObject) {
            assetObject.userData.assetId = assetId;

            assetObjects.push(assetObject);

            assetObjectMap.current.set(
              assetId,
              assetObject,
            );

            console.log(
              `Mapped ${objectName} → ${assetId}`,
            );
          } else {
            console.warn(
              `Could not find ${objectName} in GLB`,
            );
          }
        }

        setAssetsReady(true);

        for (const assetId of assetIds) {
          const object =
            assetObjectMap.current.get(assetId);

          if (!object) {
            continue;
          }

          const worldPosition =
            new THREE.Vector3();

          object.getWorldPosition(
            worldPosition,
          );

          const boundingCenter =
            new THREE.Vector3();
          new THREE.Box3().setFromObject(object).getCenter(boundingCenter);

          console.log(
            assetId,
            "position:",
            worldPosition,
          );
          console.log(
            assetId,
            "bounding center:",
            boundingCenter,
          );
        }

        // Hide oversized ground mesh
        model.traverse((object) => {
          if (object.type !== "Mesh") {
            return;
          }

          const mesh = object as THREE.Mesh;

          const box = new THREE.Box3().setFromObject(mesh);
          const size = box.getSize(new THREE.Vector3());

          if (size.x > 90 && size.z > 90) {
            mesh.visible = false;
          }
        });
      },
      undefined,
      (error) => {
        console.error(
          "Failed to load solar plant model:",
          error,
        );
      },
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
    });

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 2),
    );

    renderer.setSize(
      container.clientWidth,
      container.clientHeight,
    );

    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(
      camera,
      renderer.domElement,
    );

    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    controls.enablePan = true;
    controls.enableZoom = true;

    controls.minDistance = 2;
    controls.maxDistance = 100;

    controls.target.set(1.5, 0.3, 0);
    controls.update();

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (
      event: PointerEvent,
    ) => {
      const rect =
        renderer.domElement.getBoundingClientRect();

      mouse.x =
        ((event.clientX - rect.left) /
          rect.width) *
          2 -
        1;

      mouse.y =
        -(
          ((event.clientY - rect.top) /
            rect.height) *
            2 -
          1
        );

      raycaster.setFromCamera(
        mouse,
        camera,
      );

      const intersections =
        raycaster.intersectObjects(
          assetObjects,
          true,
        );

      if (intersections.length === 0) {
        return;
      }

      let object: THREE.Object3D | null =
        intersections[0].object;

      while (
        object &&
        !object.userData.assetId &&
        object.parent
      ) {
        object = object.parent;
      }

      const assetId =
        object?.userData.assetId;

      if (!assetId || !object) {
        return;
      }

      setSelectedAssetId(assetId);

      onAssetSelect?.(assetId);

      const currentState =
        assetStatesRef.current.find(
          (state) =>
            state.asset_id === assetId,
        );

      if (currentState) {
        applyAssetVisual(
          object,
          currentState.status,
          true,
        );
      } else {
        applyAssetVisual(
          object,
          "NORMAL",
          true,
        );
      }

      console.log(
        "Selected asset:",
        assetId,
      );
    };

    renderer.domElement.addEventListener(
      "pointerdown",
      handlePointerDown,
    );

    const ambientLight = new THREE.AmbientLight(
      0xffffff,
      2,
    );

    scene.add(ambientLight);

    const directionalLight =
      new THREE.DirectionalLight(
        0xffffff,
        2,
      );

    directionalLight.position.set(
      10,
      20,
      10,
    );

    scene.add(directionalLight);

    const groundGeometry =
      new THREE.PlaneGeometry(
        30,
        24,
      );

    const groundMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x18221b,
      });

    const ground =
      new THREE.Mesh(
        groundGeometry,
        groundMaterial,
      );

    ground.rotation.x = -Math.PI / 2;

    scene.add(ground);

    const boundaryGeometry =
      new THREE.EdgesGeometry(
        new THREE.BoxGeometry(
          30,
          0.15,
          24,
        ),
      );

    const boundaryMaterial =
      new THREE.LineBasicMaterial({
        color: 0x64748b,
      });

    const boundary =
      new THREE.LineSegments(
        boundaryGeometry,
        boundaryMaterial,
      );

    boundary.position.y = 0.08;

    scene.add(boundary);

    const grid = new THREE.GridHelper(
      28,
      28,
      0x334155,
      0x18221b,
    );

    grid.position.y = 0.01;

    scene.add(grid);

    const markerGeometry =
      new THREE.CylinderGeometry(
        0.15,
        0.15,
        0.3,
        16,
      );

    const markerMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
      });

    const marker =
      new THREE.Mesh(
        markerGeometry,
        markerMaterial,
      );

    marker.position.set(
      0,
      0.15,
      0,
    );

    scene.add(marker);

    const animate = () => {
      requestAnimationFrame(animate);

      controls.update();

      renderer.render(
        scene,
        camera,
      );
    };

    animate();

    const handleResize = () => {
      if (!containerRef.current) return;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(
        width,
        height,
      );
    };

    window.addEventListener(
      "resize",
      handleResize,
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize,
      );

      renderer.domElement.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );

      controls.dispose();

      renderer.dispose();

      if (
        renderer.domElement.parentElement ===
        container
      ) {
        container.removeChild(
          renderer.domElement,
        );
      }

      groundGeometry.dispose();
      groundMaterial.dispose();

      boundaryGeometry.dispose();
      boundaryMaterial.dispose();

      markerGeometry.dispose();
      markerMaterial.dispose();
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
