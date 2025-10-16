/**
 * Three.js 类型定义
 *
 * 为Three.js提供类型安全的工厂函数和类型定义
 */

import * as THREE from 'three';

// 类型安全的Three.js工厂函数
export const createThreeScene = () => new THREE.Scene();
export const createThreePerspectiveCamera = (fov: number, aspect: number, near: number, far: number) =>
  new THREE.PerspectiveCamera(fov, aspect, near, far);
export const createThreeWebGLRenderer = (options?: THREE.WebGLRendererParameters) =>
  new THREE.WebGLRenderer(options);
export const createThreeColor = (color: number | string) => new THREE.Color(color);
export const createThreeVector3 = (x?: number, y?: number, z?: number) => new THREE.Vector3(x, y, z);
export const createThreeVector2 = (x?: number, y?: number) => new THREE.Vector2(x, y);
export const createThreeBufferGeometry = () => new THREE.BufferGeometry();
export const createThreeLineBasicMaterial = (options?: THREE.LineBasicMaterialParameters) =>
  new THREE.LineBasicMaterial(options);
export const createThreeLine = (geometry: THREE.BufferGeometry, material: THREE.LineBasicMaterial) =>
  new THREE.Line(geometry, material);
export const createThreeLineLoop = (geometry: THREE.BufferGeometry, material: THREE.LineBasicMaterial) =>
  new THREE.LineLoop(geometry, material);
export const createThreePoints = (geometry: THREE.BufferGeometry, material: THREE.PointsMaterial) =>
  new THREE.Points(geometry, material);
export const createThreePointsMaterial = (options?: THREE.PointsMaterialParameters) =>
  new THREE.PointsMaterial(options);
export const createThreeAmbientLight = (color: number | string, intensity?: number) =>
  new THREE.AmbientLight(color, intensity);
export const createThreeDirectionalLight = (color: number | string, intensity?: number) =>
  new THREE.DirectionalLight(color, intensity);
export const createThreeHemisphereLight = (skyColor: number | string, groundColor: number | string, intensity?: number) =>
  new THREE.HemisphereLight(skyColor, groundColor, intensity);
export const createThreeGridHelper = (size: number, divisions: number, colorCenterLine?: number, colorGrid?: number) =>
  new THREE.GridHelper(size, divisions, colorCenterLine, colorGrid);
export const createThreeAxesHelper = (size: number) => new THREE.AxesHelper(size);
export const createThreeRaycaster = (origin?: THREE.Vector3, direction?: THREE.Vector3) =>
  new THREE.Raycaster(origin, direction);
export const createThreeBox3 = (min?: THREE.Vector3, max?: THREE.Vector3) => new THREE.Box3(min, max);
export const getThreePCFSoftShadowMap = () => THREE.PCFSoftShadowMap;

// 类型定义
export type ThreeScene = THREE.Scene;
export type ThreePerspectiveCamera = THREE.PerspectiveCamera;
export type ThreeWebGLRenderer = THREE.WebGLRenderer;
export type ThreeOrbitControls = any; // OrbitControls来自three/examples/jsm
export type ThreeRaycaster = THREE.Raycaster;
export type ThreeVector2 = THREE.Vector2;
export type ThreeVector3 = THREE.Vector3;
export type ThreeObject3D = THREE.Object3D;
export type ThreeAmbientLight = THREE.AmbientLight;
export type ThreeDirectionalLight = THREE.DirectionalLight;
export type ThreeHemisphereLight = THREE.HemisphereLight;
export type ThreeGridHelper = THREE.GridHelper;
export type ThreeAxesHelper = THREE.AxesHelper;
export type ThreeBufferGeometry = THREE.BufferGeometry;
export type ThreeLine = THREE.Line;
export type ThreeLineLoop = THREE.LineLoop;
export type ThreePoints = THREE.Points;
export type ThreeBox3 = THREE.Box3;
export type ThreeLineBasicMaterial = THREE.LineBasicMaterial;
export type ThreePointsMaterial = THREE.PointsMaterial;
export type ThreeColor = THREE.Color;