import * as THREE from "three";

/**
 * A lightweight, asset-free sky for the generated worlds.
 *
 * The dome follows the camera, so it never exposes an edge as the player
 * crosses a large map. Its fragment shader combines a daylight gradient, sun
 * glow and slowly drifting procedural clouds. This keeps the atmosphere crisp
 * at any resolution without adding a panorama download to the initial load.
 */

export const SKY_HORIZON_COLOR = 0xdce9f0;

const SKY_RADIUS = 700;

export class SkyEnvironment {
  private mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private uniforms: {
    uTime: { value: number };
    uSunDirection: { value: THREE.Vector3 };
  };

  constructor(scene: THREE.Scene, sunDirection: THREE.Vector3) {
    this.uniforms = {
      uTime: { value: 0 },
      uSunDirection: { value: sunDirection.clone().normalize() },
    };

    const geometry = new THREE.SphereGeometry(SKY_RADIUS, 32, 20);
    const material = new THREE.ShaderMaterial({
      name: "downtown-daylight-sky",
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDirection;

        void main() {
          vDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;

        uniform float uTime;
        uniform vec3 uSunDirection;
        varying vec3 vDirection;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);

          return mix(
            mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;
          mat2 rotation = mat2(0.80, -0.60, 0.60, 0.80);

          for (int i = 0; i < 5; i++) {
            value += noise(p) * amplitude;
            p = rotation * p * 2.03 + 17.1;
            amplitude *= 0.5;
          }

          return value;
        }

        void main() {
          vec3 direction = normalize(vDirection);
          float skyHeight = smoothstep(-0.08, 0.78, direction.y);
          vec3 horizon = vec3(0.86, 0.92, 0.95);
          vec3 zenith = vec3(0.30, 0.61, 0.84);
          vec3 color = mix(horizon, zenith, pow(skyHeight, 0.72));

          // A warm halo and compact sun disc anchor the direction of daylight.
          float sunFacing = max(dot(direction, normalize(uSunDirection)), 0.0);
          float sunHalo = pow(sunFacing, 18.0);
          float sunDisc = smoothstep(0.99955, 0.99982, sunFacing);
          color += vec3(1.0, 0.78, 0.48) * sunHalo * 0.22;
          color = mix(color, vec3(1.0, 0.95, 0.80), sunDisc * 0.92);

          // Map the hemisphere to stable cloud coordinates. Two noise scales
          // keep the cloud banks soft while preserving smaller broken edges.
          float longitude = atan(direction.z, direction.x) / 6.2831853;
          vec2 cloudUv = vec2(longitude * 7.5, direction.y * 5.2);
          cloudUv += vec2(uTime * 0.0022, uTime * 0.00035);
          float broad = fbm(cloudUv);
          float detail = fbm(cloudUv * 2.4 + 8.7);
          float density = smoothstep(0.57, 0.69, broad * 0.82 + detail * 0.28);
          float cloudBand = smoothstep(0.025, 0.14, direction.y)
            * (1.0 - smoothstep(0.72, 0.94, direction.y));
          float cloudAlpha = density * cloudBand * 0.88;

          float cloudLight = 0.72 + sunFacing * 0.28;
          vec3 cloudShade = mix(vec3(0.67, 0.74, 0.80), vec3(1.0), cloudLight);
          color = mix(color, cloudShade, cloudAlpha);

          // Bright atmospheric haze makes distant geometry blend naturally
          // into the same horizon colour used by the scene fog.
          float horizonHaze = 1.0 - smoothstep(-0.02, 0.17, direction.y);
          color = mix(color, horizon, horizonHaze * 0.72);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = "daylight-sky";
    this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update(camera: THREE.Camera, elapsedSeconds: number) {
    this.mesh.position.copy(camera.position);
    this.uniforms.uTime.value = elapsedSeconds;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
