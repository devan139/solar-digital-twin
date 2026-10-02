import { useEffect, useRef } from "react";
import * as THREE from "three";

interface PlantCameraProps {
  model: THREE.Object3D | null;
  timestamp?: string;
}

export function PlantCamera({ model, timestamp }: PlantCameraProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !model) {
      return;
    }

    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080d12);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );

    camera.position.set(5, 4, 6);
    camera.lookAt(1.5, 0.5, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);

    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xd0dce8, 1.2);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xfff8ee, 1.6);
    directionalLight.position.set(10, 15, 10);
    scene.add(directionalLight);

    const cameraModel = model.clone(true);
    scene.add(cameraModel);

    const animate = () => {
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
      animate();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [model]);

  const displayTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--:--:--";

  return (
    <section className="plant-camera" aria-label="Facility Surveillance Feed">
      <div className="section-heading camera-header">
        <div>
          <span className="section-eyebrow">
            CCTV &bull; OPTICAL SURVEILLANCE
          </span>
          <h2 className="section-title">Plant Surveillance</h2>
        </div>

        <div className="camera-live-badge">
          <span className="camera-rec-dot" />
          <span>REC &bull; LIVE</span>
        </div>
      </div>

      <div className="camera-viewport-wrap">
        <div ref={containerRef} className="camera-view" />

        <div className="camera-scanlines" />

        <div className="camera-hud-overlay">
          <div className="camera-hud-top">
            <span className="hud-cam-id">CAM-01 [ROOF-OPTICAL]</span>
            <span className="hud-time">{displayTime} UTC</span>
          </div>

          <div className="camera-reticle reticle-tl" />
          <div className="camera-reticle reticle-tr" />
          <div className="camera-reticle reticle-bl" />
          <div className="camera-reticle reticle-br" />

          <div className="camera-hud-bottom">
            <span className="hud-loc">ZONE A &bull; FIELD 1</span>
            <span className="hud-res">1080P &bull; 30 FPS</span>
          </div>
        </div>
      </div>

      <div className="camera-footer">
        <span>CAM-01</span>
        <span>MAIN ROOFTOP</span>
        <span>PTZ FIXED</span>
        <span>STREAM ACTIVE</span>
      </div>
    </section>
  );
}
