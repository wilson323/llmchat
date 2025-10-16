/**
 * Three.js 类型声明文件
 *
 * 为Three.js 0.160.0版本提供类型安全的接口
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// 类型安全的Three.js类型声明
export type ThreeScene = THREE.Scene;
export type ThreePerspectiveCamera = THREE.PerspectiveCamera;
export type ThreeCamera = THREE.Camera;
export type ThreeWebGLRenderer = THREE.WebGLRenderer;
export type ThreeOrbitControls = OrbitControls;
export type ThreeRaycaster = THREE.Raycaster;
export type ThreeVector2 = THREE.Vector2;
export type ThreeVector3 = THREE.Vector3;
export type ThreeObject3D = THREE.Object3D;
export type ThreeAmbientLight = THREE.AmbientLight;
export type ThreeDirectionalLight = THREE.DirectionalLight;
export type ThreeHemisphereLight = THREE.HemisphereLight;
export type ThreeGridHelper = THREE.GridHelper;
export type ThreeAxesHelper = THREE.AxesHelper;
export type ThreeColor = THREE.Color;
export type ThreeBufferGeometry = THREE.BufferGeometry;
export type ThreeLine = THREE.Line;
export type ThreeLineLoop = THREE.LineLoop;
export type ThreeLineBasicMaterial = THREE.LineBasicMaterial;
export type ThreePoints = THREE.Points;
export type ThreePointsMaterial = THREE.PointsMaterial;
export type ThreeBox3 = THREE.Box3;

// 类型安全的Three.js工厂函数
export function createThreeScene(): ThreeScene {
  return new THREE.Scene();
}

export function createThreePerspectiveCamera(fov: number, aspect: number, near: number, far: number): ThreePerspectiveCamera {
  return new THREE.PerspectiveCamera(fov, aspect, near, far);
}

export function createThreeWebGLRenderer(options?: THREE.WebGLRendererParameters): ThreeWebGLRenderer {
  return new THREE.WebGLRenderer(options);
}

export function createThreeColor(color: number | string): ThreeColor {
  return new THREE.Color(color);
}

export function createThreeVector3(x?: number, y?: number, z?: number): ThreeVector3 {
  return new THREE.Vector3(x, y, z);
}

export function createThreeVector2(x?: number, y?: number): ThreeVector2 {
  return new THREE.Vector2(x, y);
}

export function createThreeBufferGeometry(): ThreeBufferGeometry {
  return new THREE.BufferGeometry();
}

export function createThreeLineBasicMaterial(options?: THREE.LineBasicMaterialParameters): ThreeLineBasicMaterial {
  return new THREE.LineBasicMaterial(options);
}

export function createThreeLine(geometry: ThreeBufferGeometry, material: THREE.LineBasicMaterial): ThreeLine {
  return new THREE.Line(geometry, material);
}

export function createThreeLineLoop(geometry: ThreeBufferGeometry, material: THREE.LineBasicMaterial): ThreeLineLoop {
  return new THREE.LineLoop(geometry, material);
}

export function createThreePoints(geometry: ThreeBufferGeometry, material: ThreePointsMaterial): ThreePoints {
  return new THREE.Points(geometry, material);
}

export function createThreePointsMaterial(options?: THREE.PointsMaterialParameters): ThreePointsMaterial {
  return new THREE.PointsMaterial(options);
}

export function createThreeAmbientLight(color: number | string, intensity?: number): ThreeAmbientLight {
  return new THREE.AmbientLight(color, intensity);
}

export function createThreeDirectionalLight(color: number | string, intensity?: number): ThreeDirectionalLight {
  return new THREE.DirectionalLight(color, intensity);
}

export function createThreeHemisphereLight(skyColor: number | string, groundColor: number | string, intensity?: number): ThreeHemisphereLight {
  return new THREE.HemisphereLight(skyColor, groundColor, intensity);
}

export function createThreeGridHelper(size: number, divisions: number, colorCenterLine?: number | string, colorGrid?: number | string): ThreeGridHelper {
  return new THREE.GridHelper(size, divisions, colorCenterLine, colorGrid);
}

export function createThreeAxesHelper(size: number): ThreeAxesHelper {
  return new THREE.AxesHelper(size);
}

export function createThreeRaycaster(origin?: ThreeVector3, direction?: ThreeVector3): ThreeRaycaster {
  return new THREE.Raycaster(origin, direction);
}

export function createThreeBox3(min?: ThreeVector3, max?: ThreeVector3): ThreeBox3 {
  return new THREE.Box3(min, max);
}

export function getThreePCFSoftShadowMap(): THREE.ShadowMapType {
  return THREE.PCFSoftShadowMap;
}

// 常用的数学计算函数
export function getThreeVector3FromPoint(point: { x: number; y: number; z: number }): ThreeVector3 {
  return new THREE.Vector3(point.x, point.y, point.z);
}

export function createBufferGeometryFromPoints(points: ThreeVector3[]): ThreeBufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setFromPoints(points);
  return geometry;
}