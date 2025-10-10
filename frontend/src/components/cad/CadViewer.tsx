/**
 * CAD 可视化组件
 *
 * 使用 dxf-viewer 或 Three.js 渲染 DXF 文件
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { DxfEntity, Point3D } from '@llmchat/shared-types';
import { ZoomIn, ZoomOut, Maximize2, Grid3x3 } from 'lucide-react';

interface CadViewerProps {
  entities: DxfEntity[];
  width?: number;
  height?: number;
  onEntityClick?: (entity: DxfEntity) => void;
}

export const CadViewer: React.FC<CadViewerProps> = ({
  entities,
  width = 800,
  height = 600,
  onEntityClick: _onEntityClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [showGrid, setShowGrid] = useState(true);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    // 初始化场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    sceneRef.current = scene;

    // 初始化相机
    const camera = new THREE.PerspectiveCamera(
      75,
      width / height,
      0.1,
      10000,
    );
    camera.position.set(0, 0, 100);
    cameraRef.current = camera;

    // 初始化渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 初始化控制器
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // 添加光源
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    // 添加网格
    if (showGrid) {
      const gridHelper = new THREE.GridHelper(200, 20, 0x888888, 0xcccccc);
      gridHelper.rotation.x = Math.PI / 2;
      scene.add(gridHelper);
    }

    // 渲染循环
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 清理
    return () => {
      renderer.dispose();
      controls.dispose();
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [width, height, showGrid]);

  // 渲染 DXF 实体
  useEffect(() => {
    if (!sceneRef.current) {
      return;
    }

    const scene = sceneRef.current;

    // 清除旧的实体
    const oldEntities = scene.children.filter(
      (child) => child.userData.isEntity,
    );
    oldEntities.forEach((child) => scene.remove(child));

    // 添加新实体
    entities.forEach((entity) => {
      const mesh = createEntityMesh(entity);
      if (mesh) {
        mesh.userData.isEntity = true;
        mesh.userData.entity = entity;
        scene.add(mesh);
      }
    });

    // 调整相机视角
    fitCameraToEntities(cameraRef.current, entities);
  }, [entities]);

  // 创建实体网格
  const createEntityMesh = (entity: DxfEntity): THREE.Object3D | null => {
    const material = new THREE.LineBasicMaterial({
      color: entity.color || 0x000000,
      linewidth: 2,
    });

    switch (entity.type) {
      case 'LINE': {
        const points = [
          new THREE.Vector3(entity.start.x, entity.start.y, entity.start.z),
          new THREE.Vector3(entity.end.x, entity.end.y, entity.end.z),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        return new THREE.Line(geometry, material);
      }

      case 'CIRCLE': {
        const segments = 64;
        const points: THREE.Vector3[] = [];
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          points.push(new THREE.Vector3(
            Math.cos(angle) * entity.radius,
            Math.sin(angle) * entity.radius,
            0,
          ));
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const mesh = new THREE.LineLoop(geometry, material);
        mesh.position.set(entity.center.x, entity.center.y, entity.center.z);
        return mesh;
      }

      case 'ARC': {
        const startAngle = (entity.startAngle * Math.PI) / 180;
        const endAngle = (entity.endAngle * Math.PI) / 180;
        const segments = 64;
        const points: THREE.Vector3[] = [];
        const angleRange = endAngle - startAngle;
        for (let i = 0; i <= segments; i++) {
          const angle = startAngle + (i / segments) * angleRange;
          points.push(new THREE.Vector3(
            Math.cos(angle) * entity.radius,
            Math.sin(angle) * entity.radius,
            0,
          ));
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const mesh = new THREE.Line(geometry, material);
        mesh.position.set(entity.center.x, entity.center.y, entity.center.z);
        return mesh;
      }

      case 'POLYLINE':
      case 'LWPOLYLINE': {
        const points = entity.vertices.map(
          (v) => new THREE.Vector3(v.x, v.y, v.z),
        );
        if (entity.closed && points.length > 0) {
          points.push(points[0]);
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        return new THREE.Line(geometry, material);
      }

      case 'TEXT':
      case 'MTEXT': {
        // 文本渲染较复杂，这里简化为点
        const geometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(entity.position.x, entity.position.y, entity.position.z),
        ]);
        return new THREE.Points(
          geometry,
          new THREE.PointsMaterial({ color: 0xff0000, size: 5 }),
        );
      }

      default:
        return null;
    }
  };

  // 调整相机视角以适应所有实体
  const fitCameraToEntities = (
    camera: THREE.PerspectiveCamera | null,
    entities: DxfEntity[],
  ) => {
    if (!camera || entities.length === 0) {
      return;
    }

    const box = new THREE.Box3();
    entities.forEach((entity) => {
      const points = getEntityPoints(entity);
      points.forEach((p) => box.expandByPoint(new THREE.Vector3(p.x, p.y, p.z)));
    });

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.5; // 留一些边距

    camera.position.set(center.x, center.y, center.z + cameraZ);
    camera.lookAt(center);

    if (controlsRef.current) {
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }
  };

  // 获取实体的所有点
  const getEntityPoints = (entity: DxfEntity): Point3D[] => {
    switch (entity.type) {
      case 'LINE':
        return [entity.start, entity.end];
      case 'CIRCLE':
      case 'ARC':
        return [entity.center];
      case 'POLYLINE':
      case 'LWPOLYLINE':
        return entity.vertices;
      case 'TEXT':
      case 'MTEXT':
        return [entity.position];
      default:
        return [];
    }
  };

  // 控制按钮
  const handleZoomIn = () => {
    if (cameraRef.current) {
      cameraRef.current.position.multiplyScalar(0.8);
    }
  };

  const handleZoomOut = () => {
    if (cameraRef.current) {
      cameraRef.current.position.multiplyScalar(1.2);
    }
  };

  const handleFitView = () => {
    fitCameraToEntities(cameraRef.current, entities);
  };

  return (
    <div className="relative">
      <div ref={containerRef} className="rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600" />

      {/* 控制按钮 */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-white dark:bg-gray-800 rounded shadow hover:bg-gray-100 dark:hover:bg-gray-700"
          title="放大"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-white dark:bg-gray-800 rounded shadow hover:bg-gray-100 dark:hover:bg-gray-700"
          title="缩小"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={handleFitView}
          className="p-2 bg-white dark:bg-gray-800 rounded shadow hover:bg-gray-100 dark:hover:bg-gray-700"
          title="适应视图"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`p-2 rounded shadow ${
            showGrid
              ? 'bg-blue-500 text-white'
              : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title="切换网格"
        >
          <Grid3x3 className="w-5 h-5" />
        </button>
      </div>

      {/* 实体计数 */}
      <div className="absolute bottom-4 left-4 px-3 py-1 bg-white dark:bg-gray-800 rounded shadow text-sm">
        实体数量: {entities.length}
      </div>
    </div>
  );
};
