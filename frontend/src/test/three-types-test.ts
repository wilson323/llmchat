/**
 * Three.js 类型验证测试
 */

import * as THREE from 'three';
import {
  createThreeScene,
  createThreePerspectiveCamera,
  createThreeWebGLRenderer,
  createThreeColor,
  createThreeVector3,
  createThreeBufferGeometry,
  createThreeLineBasicMaterial,
  createThreeLine,
  type ThreeScene,
  type ThreePerspectiveCamera,
  type ThreeWebGLRenderer,
  type ThreeVector3,
} from '../types/three-js-types';

// 测试工厂函数
export function testThreeJSTypes() {
  // 测试场景创建
  const scene: ThreeScene = createThreeScene();
  scene.background = createThreeColor(0xf0f0f0);

  // 测试相机创建
  const camera: ThreePerspectiveCamera = createThreePerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, 0, 5);

  // 测试渲染器创建
  const renderer: ThreeWebGLRenderer = createThreeWebGLRenderer({ antialias: true });
  renderer.setSize(800, 600);

  // 测试3D对象创建
  const geometry = createThreeBufferGeometry();
  const material = createThreeLineBasicMaterial({ color: 0x00ff00 });
  const line = createThreeLine(geometry, material);

  // 测试向量操作
  const vector: ThreeVector3 = createThreeVector3(1, 2, 3);
  const normalized = vector.clone().normalize();

  // 验证类型安全
  console.log('Three.js types validated successfully');
  return {
    scene,
    camera,
    renderer,
    line,
    vector,
    normalized,
  };
}

// 测试兼容性
export function testThreeJSCompatibility() {
  // 确保我们的类型与原生THREE.js兼容
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer();

  // 测试类型兼容性
  const typedScene: ThreeScene = scene;
  const typedCamera: ThreePerspectiveCamera = camera;
  const typedRenderer: ThreeWebGLRenderer = renderer;

  return { typedScene, typedCamera, typedRenderer };
}