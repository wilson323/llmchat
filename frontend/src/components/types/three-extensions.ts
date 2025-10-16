/**
 * Three.js 类型扩展
 *
 * 简化的类型扩展，避免与Three.js官方类型冲突
 * 主要提供OrbitControls的类型定义
 */

// OrbitControls 类型定义
declare module 'three/examples/jsm/controls/OrbitControls' {
  import { Camera, MOUSE, Vector3 } from 'three';

  export class OrbitControls {
    constructor(object: Camera, domElement?: HTMLElement);

    object: Camera;
    domElement: HTMLElement | undefined;

    // 基本属性
    enabled: boolean;
    target: Vector3;

    // 阻尼属性
    enableDamping: boolean;
    dampingFactor: number;

    // 缩放
    enableZoom: boolean;
    zoomSpeed: number;
    minDistance: number;
    maxDistance: number;

    // 旋转
    enableRotate: boolean;
    rotateSpeed: number;
    minAzimuthAngle: number;
    maxAzimuthAngle: number;
    minPolarAngle: number;
    maxPolarAngle: number;

    // 平移
    enablePan: boolean;
    panSpeed: number;
    screenSpacePanning: boolean;
    keyPanSpeed: number;

    // 按键
    keys: { LEFT: string; UP: string; RIGHT: string; BOTTOM: string };
    mouseButtons: { LEFT: MOUSE; MIDDLE: MOUSE; RIGHT: MOUSE };

    // 方法
    update(): boolean;
    saveState(): void;
    reset(): void;
    dispose(): void;
    getPolarAngle(): number;
    getAzimuthalAngle(): number;
    getDistance(): number;
  }
}