import { useEffect, useRef } from "react";
import * as THREE from "three";

interface PlantCameraProps {
  model: THREE.Object3D | null;
}

export function PlantCamera({
  model,
}: PlantCameraProps) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !model) {
      return;
    }

    const container =
      containerRef.current;

    const scene = new THREE.Scene();

    scene.background =
      new THREE.Color(0x080d12);

    const camera =
      new THREE.PerspectiveCamera(
        45,
        container.clientWidth /
          container.clientHeight,
        0.1,
        1000,
      );

    camera.position.set(
      5,
      4,
      6,
    );

    camera.lookAt(
      1.5,
      0.5,
      0,
    );

    const renderer =
      new THREE.WebGLRenderer({
        antialias: true,
      });

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 2),
    );

    renderer.setSize(
      container.clientWidth,
      container.clientHeight,
    );

    container.appendChild(
      renderer.domElement,
    );

    const ambientLight =
      new THREE.AmbientLight(
        0xffffff,
        1.4,
      );

    scene.add(ambientLight);

    const directionalLight =
      new THREE.DirectionalLight(
        0xffffff,
        2,
      );

    directionalLight.position.set(
      10,
      15,
      10,
    );

    scene.add(directionalLight);

    const cameraModel =
      model.clone(true);

    scene.add(cameraModel);

    const animate = () => {
      renderer.render(
        scene,
        camera,
      );
    };

    animate();

    const handleResize = () => {
      if (!containerRef.current) {
        return;
      }

      const width =
        containerRef.current.clientWidth;

      const height =
        containerRef.current.clientHeight;

      camera.aspect =
        width / height;

      camera.updateProjectionMatrix();

      renderer.setSize(
        width,
        height,
      );

      animate();
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

      renderer.dispose();

      if (
        renderer.domElement.parentElement
      ) {
        renderer.domElement.parentElement.removeChild(
          renderer.domElement,
        );
      }
    };
  }, [model]);

  return (
    <section className="plant-camera">
      <div className="camera-header">
        <div>
          <span>
            SURVEILLANCE
          </span>

          <h2>
            Simulated Plant Camera
          </h2>
        </div>

        <div className="camera-live">
          <span />
          LIVE
        </div>
      </div>

      <div
        ref={containerRef}
        className="camera-view"
      />

      <div className="camera-footer">
        <span>CAM-01</span>

        <span>
          SOLAR FIELD
        </span>

        <span>
          SIMULATED FEED
        </span>
      </div>
    </section>
  );
}
