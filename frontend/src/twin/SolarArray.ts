import * as THREE from "three";

export function createSolarArray(
  assetId: string,
): THREE.Group {
  const group = new THREE.Group();

  group.name = assetId;
  group.userData.assetId = assetId;

  const panelMaterial =
    new THREE.MeshStandardMaterial({
      color: 0x1e3a5f,
      roughness: 0.6,
      metalness: 0.2,
    });

  const frameMaterial =
    new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.7,
      metalness: 0.4,
    });

  const panelWidth = 1.2;
  const panelHeight = 0.7;

  const columns = 6;
  const rows = 3;

  const panelGeometry =
    new THREE.BoxGeometry(
      panelWidth,
      0.08,
      panelHeight,
    );

  for (let row = 0; row < rows; row++) {
    for (
      let column = 0;
      column < columns;
      column++
    ) {
      const panel =
        new THREE.Mesh(
          panelGeometry,
          panelMaterial,
        );

      panel.position.x =
        column * 1.25 -
        ((columns - 1) * 1.25) / 2;

      panel.position.z =
        row * 0.75 -
        ((rows - 1) * 0.75) / 2;

      panel.rotation.x =
        -THREE.MathUtils.degToRad(20);

      group.add(panel);
    }
  }

  const supportGeometry =
    new THREE.BoxGeometry(
      0.12,
      0.8,
      0.12,
    );

  const supportPositions = [
    [-3.2, -1, -1],
    [3.2, -1, -1],
    [-3.2, -1, 1],
    [3.2, -1, 1],
  ];

  for (const [x, y, z] of supportPositions) {
    const support =
      new THREE.Mesh(
        supportGeometry,
        frameMaterial,
      );

    support.position.set(
      x,
      y,
      z,
    );

    group.add(support);
  }

  group.position.y = 1;

  return group;
}

export function disposeSolarArray(
  group: THREE.Group,
) {
  group.traverse((object) => {
    if (
      object instanceof THREE.Mesh
    ) {
      object.geometry.dispose();

      if (
        Array.isArray(object.material)
      ) {
        object.material.forEach(
          (material) =>
            material.dispose(),
        );
      } else {
        object.material.dispose();
      }
    }
  });
}
