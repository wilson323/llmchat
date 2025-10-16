/**
 * CAD组件类型测试
 */

import * as THREE from 'three';
import { CadViewer } from './src/components/cad/CadViewer';
import CadViewerEnhanced from './src/components/cad/CadViewerEnhanced';
import { CadUpload } from './src/components/cad/CadUpload';
import CadUploadEnhanced from './src/components/cad/CadUploadEnhanced';
import type { DxfEntity, CadFileInfo } from '@llmchat/shared-types';

// 测试类型是否正确
const testDxfEntity: DxfEntity = {
  type: 'LINE',
  handle: 'test',
  layer: 'test-layer',
  start: { x: 0, y: 0, z: 0 },
  end: { x: 1, y: 1, z: 0 },
};

const testCadFileInfo: CadFileInfo = {
  id: 'test-id',
  fileName: 'test.dxf',
  fileSize: 1024,
  uploadedAt: new Date().toISOString(),
  entityCount: 1,
  layers: ['test-layer'],
};

// 测试Three.js类型
const testScene = new THREE.Scene();
const testCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
const testRenderer = new THREE.WebGLRenderer();

console.log('CAD类型测试通过:', testDxfEntity, testCadFileInfo);
console.log('Three.js类型测试通过:', testScene, testCamera, testRenderer);

export { testDxfEntity, testCadFileInfo, testScene, testCamera, testRenderer };