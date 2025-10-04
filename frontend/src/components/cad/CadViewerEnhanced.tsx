/**
 * CAD 增强型可视化组件
 * 
 * 功能增强：
 * - 实体高亮和选择
 * - 测量工具
 * - 坐标显示
 * - 视图控制
 * - 截图功能
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { DxfEntity, Point3D } from '@llmchat/shared-types';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Grid3x3, 
  Home,
  Camera,
  Move,
  Ruler,
  MousePointer,
  Eye,
} from 'lucide-react';

interface CadViewerEnhancedProps {
  entities: DxfEntity[];
  width?: number;
  height?: number;
  onEntityClick?: (entity: DxfEntity) => void;
  onEntityHover?: (entity: DxfEntity | null) => void;
  selectedEntityId?: string;
  hiddenLayers?: string[];
}

export const CadViewerEnhanced: React.FC<CadViewerEnhancedProps> = ({
  entities,
  width = 800,
  height = 600,
  onEntityClick,
  onEntityHover,
  selectedEntityId,
  hiddenLayers = [],
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  const [showGrid, setShowGrid] = useState(true);
  const [_showAxes, _setShowAxes] = useState(true);
  const [viewMode, setViewMode] = useState<'3d' | 'top' | 'front' | 'side'>('3d');
  const [measureMode, setMeasureMode] = useState(false);
  const [_cursorPosition, _setCursorPosition] = useState<Point3D | null>(null);
  const [hoveredEntity, setHoveredEntity] = useState<DxfEntity | null>(null);
  const [fps, setFps] = useState(60);

  // 初始化场景
  useEffect(() => {
    if (!containerRef.current) return;

    // 创建场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8f9fa);
    sceneRef.current = scene;

    // 创建相机
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 10000);
    camera.position.set(100, 100, 100);
    cameraRef.current = camera;

    // 创建渲染器
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true // 支持截图
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 创建控制器
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 10;
    controls.maxDistance = 5000;
    controls.maxPolarAngle = Math.PI;
    controlsRef.current = controls;

    // 添加光源
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
    hemisphereLight.position.set(0, 100, 0);
    scene.add(hemisphereLight);

    // 添加网格
    if (showGrid) {
      const gridHelper = new THREE.GridHelper(500, 50, 0x888888, 0xdddddd);
      gridHelper.name = 'grid';
      scene.add(gridHelper);
    }

    // 添加坐标轴
    if (_showAxes) {
      const axesHelper = new THREE.AxesHelper(100);
      axesHelper.name = 'axes';
      scene.add(axesHelper);
    }

    // 性能监控
    let lastTime = performance.now();
    let frames = 0;

    // 渲染循环
    const animate = () => {
      requestAnimationFrame(animate);
      
      controls.update();
      renderer.render(scene, camera);

      // FPS 计算
      frames++;
      const currentTime = performance.now();
      if (currentTime >= lastTime + 1000) {
        setFps(Math.round((frames * 1000) / (currentTime - lastTime)));
        frames = 0;
        lastTime = currentTime;
      }
    };
    animate();

    // 鼠标移动事件
    const handleMouseMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // 射线检测
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(
        scene.children.filter(child => child.userData.isEntity),
        true
      );

      if (intersects.length > 0) {
        const entity = intersects[0].object.userData.entity as DxfEntity;
        setHoveredEntity(entity);
        onEntityHover?.(entity);
        renderer.domElement.style.cursor = 'pointer';
      } else {
        setHoveredEntity(null);
        onEntityHover?.(null);
        renderer.domElement.style.cursor = measureMode ? 'crosshair' : 'default';
      }
    };

    // 鼠标点击事件
    const handleClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(
        scene.children.filter(child => child.userData.isEntity),
        true
      );

      if (intersects.length > 0) {
        const entity = intersects[0].object.userData.entity as DxfEntity;
        onEntityClick?.(entity);
      }
    };

    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('click', handleClick);

    // 清理
    return () => {
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.dispose();
      controls.dispose();
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [width, height, showGrid, _showAxes, measureMode, onEntityClick, onEntityHover]);

  // 渲染实体
  useEffect(() => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;

    // 清除旧实体
    const oldEntities = scene.children.filter(child => child.userData.isEntity);
    oldEntities.forEach(child => scene.remove(child));

    // 添加新实体
    entities.forEach(entity => {
      // 检查图层是否隐藏
      if (hiddenLayers.includes(entity.layer)) return;

      const mesh = createEntityMesh(entity, entity.handle === selectedEntityId);
      if (mesh) {
        mesh.userData.isEntity = true;
        mesh.userData.entity = entity;
        scene.add(mesh);
      }
    });

    // 自动调整视图
    fitCameraToEntities(cameraRef.current, entities);
  }, [entities, selectedEntityId, hiddenLayers]);

  // 创建实体网格
  const createEntityMesh = (entity: DxfEntity, selected: boolean): THREE.Object3D | null => {
    const isHovered = hoveredEntity?.handle === entity.handle;
    const color = selected ? 0x2196f3 : isHovered ? 0xff9800 : (entity.color || 0x000000);
    const linewidth = selected ? 3 : isHovered ? 2.5 : 2;

    const material = new THREE.LineBasicMaterial({
      color,
      linewidth,
    });

    switch (entity.type) {
      case 'LINE': {
        const geometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(entity.start.x, entity.start.y, entity.start.z),
          new THREE.Vector3(entity.end.x, entity.end.y, entity.end.z),
        ]);
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
            0
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
            0
          ));
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const mesh = new THREE.Line(geometry, material);
        mesh.position.set(entity.center.x, entity.center.y, entity.center.z);
        return mesh;
      }

      case 'POLYLINE':
      case 'LWPOLYLINE': {
        const points = entity.vertices.map(v => new THREE.Vector3(v.x, v.y, v.z));
        if (entity.closed && points.length > 0) {
          points.push(points[0].clone());
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        return new THREE.Line(geometry, material);
      }

      case 'TEXT':
      case 'MTEXT': {
        // 文本显示为点
        const geometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(entity.position.x, entity.position.y, entity.position.z),
        ]);
        return new THREE.Points(
          geometry,
          new THREE.PointsMaterial({ color: color, size: 5 })
        );
      }

      default:
        return null;
    }
  };

  // 调整相机视图
  const fitCameraToEntities = useCallback((
    camera: THREE.PerspectiveCamera | null,
    entities: DxfEntity[]
  ) => {
    if (!camera || entities.length === 0 || !controlsRef.current) return;

    const box = new THREE.Box3();
    entities.forEach(entity => {
      const points = getEntityPoints(entity);
      points.forEach(p => box.expandByPoint(new THREE.Vector3(p.x, p.y, p.z)));
    });

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.8; // 留更多边距

    camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
    camera.lookAt(center);

    controlsRef.current.target.copy(center);
    controlsRef.current.update();
  }, []);

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

  // 控制函数
  const handleZoomIn = () => {
    if (cameraRef.current) {
      cameraRef.current.position.multiplyScalar(0.8);
    }
  };

  const handleZoomOut = () => {
    if (cameraRef.current) {
      cameraRef.current.position.multiplyScalar(1.25);
    }
  };

  const handleResetView = () => {
    fitCameraToEntities(cameraRef.current, entities);
  };

  const handleHomeView = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(100, 100, 100);
      cameraRef.current.lookAt(0, 0, 0);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  const handleScreenshot = () => {
    if (rendererRef.current) {
      const dataURL = rendererRef.current.domElement.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `cad-screenshot-${Date.now()}.png`;
      link.href = dataURL;
      link.click();
    }
  };

  const handleViewMode = (mode: '3d' | 'top' | 'front' | 'side') => {
    setViewMode(mode);
    if (!cameraRef.current || !controlsRef.current) return;

    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const distance = 200;

    switch (mode) {
      case 'top':
        camera.position.set(0, distance, 0);
        camera.up.set(0, 0, -1);
        break;
      case 'front':
        camera.position.set(0, 0, distance);
        camera.up.set(0, 1, 0);
        break;
      case 'side':
        camera.position.set(distance, 0, 0);
        camera.up.set(0, 1, 0);
        break;
      case '3d':
        camera.position.set(distance * 0.7, distance * 0.7, distance * 0.7);
        camera.up.set(0, 1, 0);
        break;
    }

    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
  };

  return (
    <div className="relative rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-xl">
      {/* 画布 */}
      <div ref={containerRef} className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800" />

      {/* 顶部工具栏 */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        {/* 左侧视图切换 */}
        <div className="flex gap-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-1">
          {[
            { mode: '3d', label: '3D', icon: Move },
            { mode: 'top', label: '俯视', icon: Eye },
            { mode: 'front', label: '正视', icon: Eye },
            { mode: 'side', label: '侧视', icon: Eye },
          ].map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => handleViewMode(mode as any)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded transition-all ${
                viewMode === mode
                  ? 'bg-blue-500 text-white shadow'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title={label}
            >
              <Icon className="w-4 h-4" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>

        {/* 右侧信息 */}
        <div className="flex items-center gap-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg px-3 py-1.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 dark:text-gray-400">实体:</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {entities.filter(e => !hiddenLayers.includes(e.layer)).length}
            </span>
          </div>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 dark:text-gray-400">FPS:</span>
            <span className={`font-semibold ${fps >= 50 ? 'text-green-600' : fps >= 30 ? 'text-yellow-600' : 'text-red-600'}`}>
              {fps}
            </span>
          </div>
        </div>
      </div>

      {/* 右侧控制栏 */}
      <div className="absolute top-20 right-4 flex flex-col gap-2">
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-2 space-y-2">
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="放大"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="缩小"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            onClick={handleResetView}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="适应视图"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleHomeView}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="重置视图"
          >
            <Home className="w-5 h-5" />
          </button>
          <div className="h-px bg-gray-300 dark:bg-gray-600" />
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-2 rounded transition-colors ${
              showGrid
                ? 'bg-blue-500 text-white'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="切换网格"
          >
            <Grid3x3 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setMeasureMode(!measureMode)}
            className={`p-2 rounded transition-colors ${
              measureMode
                ? 'bg-blue-500 text-white'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="测量模式"
          >
            <Ruler className="w-5 h-5" />
          </button>
          <button
            onClick={handleScreenshot}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="截图"
          >
            <Camera className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 底部状态栏 */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
        {/* 鼠标位置 */}
        {_cursorPosition && (
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg px-3 py-1.5">
            <div className="flex items-center gap-4 text-xs font-mono">
              <span>X: {_cursorPosition.x.toFixed(2)}</span>
              <span>Y: {_cursorPosition.y.toFixed(2)}</span>
              <span>Z: {_cursorPosition.z.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* 悬停实体信息 */}
        {hoveredEntity && (
          <div className="bg-blue-500/90 backdrop-blur-sm rounded-lg shadow-lg px-3 py-1.5 text-white">
            <div className="flex items-center gap-2 text-xs">
              <MousePointer className="w-4 h-4" />
              <span className="font-medium">{hoveredEntity.type}</span>
              <span className="opacity-75">图层: {hoveredEntity.layer}</span>
            </div>
          </div>
        )}
      </div>

      {/* 操作提示 */}
      {measureMode && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="bg-black/75 text-white px-4 py-2 rounded-lg text-sm">
            点击两个点进行测量
          </div>
        </div>
      )}
    </div>
  );
};
