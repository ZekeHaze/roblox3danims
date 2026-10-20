'use client';

import { useEffect, useRef, useState, ChangeEvent } from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

interface JointInfo {
  id: string;
  name: string;
  pivotGroup: THREE.Group;
  mesh: THREE.Mesh;
}

const BONE_PRESETS = {
  ROBLOX_R6: [
    { name: 'HumanoidRootPart', pos: [0, 0, 0], parent: null },
    { name: 'Torso', pos: [0, 1, 0], parent: 'HumanoidRootPart' },
    { name: 'Head', pos: [0, 2, 0], parent: 'Torso' },
    { name: 'LeftArm', pos: [-1.5, 1, 0], parent: 'Torso' },
    { name: 'RightArm', pos: [1.5, 1, 0], parent: 'Torso' },
    { name: 'LeftLeg', pos: [-0.5, -1, 0], parent: 'Torso' },
    { name: 'RightLeg', pos: [0.5, -1, 0], parent: 'Torso' },
  ],
};

export default function Scene3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [joints, setJoints] = useState<JointInfo[]>([]);
  const [selectedJointId, setSelectedJointId] = useState<string | null>(null);
  const [checkedJointIds, setCheckedJointIds] = useState<string[]>([]);
  const [stats, setStats] = useState({ vertices: 0, triangles: 0 });
  const [fileName, setFileName] = useState<string>('Ningún archivo cargado');

  // Modos de transformación: 'rotate' (aros), 'translate' (flechas X, Y, Z), 'pivot' (ajustar origen)
  const [transformMode, setTransformMode] = useState<'rotate' | 'translate' | 'pivot'>('rotate');

  // Offset manual del pivote
  const [pivotOffset, setPivotOffset] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rootCharacterGroupRef = useRef<THREE.Group | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Escena
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#222225');
    sceneRef.current = scene;

    // 2. Cámara
    const camera = new THREE.PerspectiveCamera(
      45,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 3, 10);

    // 3. Renderizador
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    // 4. Controles de Órbita
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;

    // 5. Controles de Transformación
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setMode('rotate');
    transformControlsRef.current = transformControls;

    transformControls.addEventListener('dragging-changed', (event) => {
      orbitControls.enabled = !event.value;
    });

    scene.add(transformControls.getHelper());

    // 6. Luces
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.8);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight1.position.set(5, 12, 8);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight2.position.set(-5, 5, -5);
    scene.add(dirLight2);

    // Resize
    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Render loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      orbitControls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Cambiar herramienta
  const handleModeChange = (mode: 'rotate' | 'translate' | 'pivot') => {
    setTransformMode(mode);
    if (!transformControlsRef.current) return;

    if (mode === 'rotate') {
      transformControlsRef.current.setMode('rotate');
    } else {
      transformControlsRef.current.setMode('translate');
    }

    const selectedJoint = joints.find((j) => j.id === selectedJointId);
    if (selectedJoint) {
      transformControlsRef.current.attach(
        mode === 'pivot' ? selectedJoint.mesh : selectedJoint.pivotGroup
      );
    }
  };

  const selectJoint = (jointInfo: JointInfo) => {
    setSelectedJointId(jointInfo.id);
    setPivotOffset({
      x: jointInfo.mesh.position.x,
      y: jointInfo.mesh.position.y,
      z: jointInfo.mesh.position.z
    });

    if (transformControlsRef.current) {
      transformControlsRef.current.attach(
        transformMode === 'pivot' ? jointInfo.mesh : jointInfo.pivotGroup
      );
    }
  };

  const clearSelection = () => {
    setSelectedJointId(null);
    if (transformControlsRef.current) {
      transformControlsRef.current.detach();
    }
  };

  // Mover offset del pivote
  const updatePivotOffset = (axis: 'x' | 'y' | 'z', value: number) => {
    const selectedJoint = joints.find((j) => j.id === selectedJointId);
    if (!selectedJoint) return;

    const newOffset = { ...pivotOffset, [axis]: value };
    setPivotOffset(newOffset);

    selectedJoint.mesh.position.set(-newOffset.x, -newOffset.y, -newOffset.z);
    selectedJoint.pivotGroup.position.set(newOffset.x, newOffset.y, newOffset.z);
  };

  // Manejador de casillas de verificación
  const toggleCheckJoint = (id: string) => {
    setCheckedJointIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // FUNCIONALIDAD: AGRUPAR RIGS / ARTICULACIONES
  const groupSelectedJoints = () => {
    if (checkedJointIds.length < 2) {
      alert('Debes seleccionar al menos 2 partes usando las casillas de verificación para agruparlas.');
      return;
    }

    const selectedJointsToGroup = joints.filter((j) => checkedJointIds.includes(j.id));
    const remainingJoints = joints.filter((j) => !checkedJointIds.includes(j.id));

    // Crear un nuevo grupo contenedor en Three.js
    const groupContainer = new THREE.Group();
    groupContainer.name = `Grupo_${selectedJointsToGroup.map((j) => j.name).join('_')}`;

    // Calcular la posición central del nuevo grupo
    const box = new THREE.Box3();
    selectedJointsToGroup.forEach((j) => box.expandByObject(j.pivotGroup));
    const center = box.getCenter(new THREE.Vector3());
    groupContainer.position.copy(center);

    // Adjuntar los pivotes existentes dentro del grupo contenedor
    selectedJointsToGroup.forEach((j) => {
      j.pivotGroup.position.sub(center);
      groupContainer.add(j.pivotGroup);
    });

    if (rootCharacterGroupRef.current) {
      rootCharacterGroupRef.current.add(groupContainer);
    }

    // Crear la nueva articulación unificada
    const newGroupId = `group_${Date.now()}`;
    const newGroupJoint: JointInfo = {
      id: newGroupId,
      name: `🔗 Grupo Uni (${selectedJointsToGroup.length} Partes)`,
      pivotGroup: groupContainer,
      mesh: selectedJointsToGroup[0].mesh // Referencia primaria
    };

    const updatedJoints = [newGroupJoint, ...remainingJoints];
    setJoints(updatedJoints);
    setCheckedJointIds([]);
    selectJoint(newGroupJoint);
  };

  const createJointNode = (mesh: THREE.Mesh): THREE.Group => {
    const pivotGroup = new THREE.Group();
    pivotGroup.name = `Pivot_${mesh.name || 'Part'}`;

    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());

    const nameLower = (mesh.name || '').toLowerCase();
    let pivotPosition = center.clone();

    if (nameLower.includes('arm') || nameLower.includes('leg') || nameLower.includes('head') || nameLower.includes('hand') || nameLower.includes('rig')) {
      pivotPosition.y = box.max.y;
    }

    pivotGroup.position.copy(pivotPosition);
    mesh.position.sub(pivotPosition);
    pivotGroup.add(mesh);

    return pivotGroup;
  };

  const processAndDisplayModel = (loadedGroup: THREE.Group | undefined, name: string, textureTexture?: THREE.Texture) => {
    if (!loadedGroup || !sceneRef.current) return;

    clearSelection();
    setCheckedJointIds([]);
    if (rootCharacterGroupRef.current) {
      sceneRef.current.remove(rootCharacterGroupRef.current);
    }

    const mainCharacterGroup = new THREE.Group();
    rootCharacterGroupRef.current = mainCharacterGroup;
    setFileName(name);

    let totalVertices = 0;
    let totalTriangles = 0;
    const jointList: JointInfo[] = [];

    const defaultMaterial = new THREE.MeshLambertMaterial({
      color: 0xdddddd,
      side: THREE.DoubleSide
    });

    const texturedMaterial = textureTexture
      ? new THREE.MeshBasicMaterial({
          map: textureTexture,
          side: THREE.DoubleSide
        })
      : null;

    const meshesFound: THREE.Mesh[] = [];
    if (typeof loadedGroup.traverse === 'function') {
      loadedGroup.traverse((child) => {
        if (child && (child as THREE.Mesh).isMesh) {
          meshesFound.push(child as THREE.Mesh);
        }
      });
    }

    meshesFound.forEach((mesh, index) => {
      mesh.material = texturedMaterial || defaultMaterial;

      const pivotGroup = createJointNode(mesh);
      mainCharacterGroup.add(pivotGroup);

      const jointId = `joint_${index}_${mesh.name || 'Part'}`;
      jointList.push({
        id: jointId,
        name: mesh.name || `Parte ${index + 1}`,
        pivotGroup: pivotGroup,
        mesh: mesh
      });

      if (mesh.geometry) {
        const posAttr = mesh.geometry.attributes.position;
        if (posAttr) totalVertices += posAttr.count;
        if (mesh.geometry.index) {
          totalTriangles += mesh.geometry.index.count / 3;
        } else if (posAttr) {
          totalTriangles += posAttr.count / 3;
        }
      }
    });

    const box = new THREE.Box3().setFromObject(mainCharacterGroup);
    const center = box.getCenter(new THREE.Vector3());
    mainCharacterGroup.position.sub(center);

    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 5 / maxDim;
      mainCharacterGroup.scale.set(scale, scale, scale);
    }

    sceneRef.current.add(mainCharacterGroup);
    setJoints(jointList);
    setStats({ vertices: totalVertices, triangles: Math.round(totalTriangles) });
  };
const applyRobloxRig = () => {
    if (!rootCharacterGroupRef.current || !sceneRef.current) {
      alert('Primero debes cargar un modelo 3D en la escena.');
      return;
    }

    const presetData = BONE_PRESETS.ROBLOX_R6;
    const bonesMap: { [key: string]: THREE.Bone } = {};
    const bonesList: THREE.Bone[] = [];

    presetData.forEach((b) => {
      const bone = new THREE.Bone();
      bone.name = b.name;
      bone.position.set(b.pos[0], b.pos[1], b.pos[2]);
      bonesMap[b.name] = bone;
      bonesList.push(bone);
    });

    presetData.forEach((b) => {
      if (b.parent && bonesMap[b.parent]) {
        bonesMap[b.parent].add(bonesMap[b.name]);
      }
    });

    const skeletonRoot = new THREE.Group();
    skeletonRoot.name = 'Rig_Roblox_R6';
    skeletonRoot.add(bonesList[0]);

    const skeleton = new THREE.Skeleton(bonesList);

    rootCharacterGroupRef.current.add(skeletonRoot);

    const skeletonHelper = new THREE.SkeletonHelper(skeletonRoot);
    (skeletonHelper as any).material.linewidth = 3;
    sceneRef.current.add(skeletonHelper);

    alert('¡Esqueleto de Roblox R6 aplicado con éxito!');
  };
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let objFile: File | null = null;
    let textureFile: File | null = null;

    Array.from(files).forEach((file) => {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('.obj')) objFile = file;
      if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
        textureFile = file;
      }
    });

    if (!objFile) {
      alert('Debes seleccionar al menos un archivo .obj');
      return;
    }

    const objUrl = URL.createObjectURL(objFile);
    const objLoader = new OBJLoader();

    if (textureFile) {
      const textureUrl = URL.createObjectURL(textureFile);
      const textureLoader = new THREE.TextureLoader();

      textureLoader.load(
        textureUrl,
        (loadedTexture) => {
          loadedTexture.colorSpace = THREE.SRGBColorSpace;
          objLoader.load(
            objUrl,
            (group) => {
              if (group) processAndDisplayModel(group, `${objFile!.name} (+ Textura)`, loadedTexture);
            },
            undefined,
            (err) => console.error('Error cargando OBJ con textura:', err)
          );
        },
        undefined,
        () => {
          objLoader.load(
            objUrl,
            (group) => {
              if (group) processAndDisplayModel(group, objFile!.name);
            },
            undefined,
            (err) => console.error('Error cargando OBJ sin textura:', err)
          );
        }
      );
    } else {
      objLoader.load(
        objUrl,
        (group) => {
          if (group) processAndDisplayModel(group, objFile!.name);
        },
        undefined,
        (err) => console.error('Error cargando OBJ:', err)
      );
    }
  };

  const selectedJoint = joints.find((j) => j.id === selectedJointId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#18181b', color: '#fff' }}>
      
      {/* Barra superior de herramientas */}
      <div style={{ padding: '10px 20px', background: '#27272a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #3f3f46' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{
            backgroundColor: '#2563eb',
            color: '#ffffff',
            padding: '8px 14px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            📁 Cargar .OBJ (+ PNG)
            <input 
              type="file" 
              accept=".obj,.png,.jpg,.jpeg" 
              multiple 
              onChange={handleFileUpload} 
              style={{ display: 'none' }} 
            />
          </label>
          <span style={{ fontSize: '13px', color: '#a1a1aa' }}>
            {fileName}
          </span>
        </div>

        {/* Botones de acción y herramientas */}
        {joints.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={applyRobloxRig}
              style={{
                backgroundColor: '#7c3aed',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              🦴 Aplicar Rig Roblox R6
            </button>

            {checkedJointIds.length >= 2 && (
              <button
                onClick={groupSelectedJoints}
                style={{
                  backgroundColor: '#16a34a',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600'
                }}
              >
                🔗 Agrupar Selección ({checkedJointIds.length})
              </button>
            )}

            <button
              onClick={() => handleModeChange('rotate')}
              style={{
                backgroundColor: transformMode === 'rotate' ? '#2563eb' : '#3f3f46',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              🔄 Rotar
            </button>
            <button
              onClick={() => handleModeChange('translate')}
              style={{
                backgroundColor: transformMode === 'translate' ? '#2563eb' : '#3f3f46',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              ⤞ Mover (X, Y, Z)
            </button>
            <button
              onClick={() => handleModeChange('pivot')}
              style={{
                backgroundColor: transformMode === 'pivot' ? '#2563eb' : '#3f3f46',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              🎯 Ajustar Pivote
            </button>
            {selectedJointId && (
              <button
                onClick={clearSelection}
                style={{
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ✖ Deseleccionar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Visor 3D y Controles */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Panel Izquierdo: Lista de Articulaciones con Selección Múltiple */}
        <div style={{ width: '260px', background: '#18181b', padding: '15px', overflowY: 'auto', borderRight: '1px solid #27272a' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', textTransform: 'uppercase', color: '#71717a' }}>
            Articulaciones ({joints.length})
          </h4>
          <p style={{ fontSize: '11px', color: '#a1a1aa', margin: '0 0 12px 0' }}>
            Marca las casillas para seleccionar múltiples partes y luego pulsa <strong>Agrupar Selección</strong>:
          </p>
          {joints.map((j) => {
            const isSelected = j.id === selectedJointId;
            const isChecked = checkedJointIds.includes(j.id);

            return (
              <div
                key={j.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 8px',
                  fontSize: '12px',
                  color: isSelected ? '#fff' : '#d4d4d8',
                  backgroundColor: isSelected ? '#2563eb' : 'transparent',
                  borderRadius: '6px',
                  marginBottom: '4px',
                  border: isSelected ? '1px solid #60a5fa' : '1px solid transparent'
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleCheckJoint(j.id)}
                  style={{ cursor: 'pointer' }}
                />
                <span
                  onClick={() => selectJoint(j)}
                  style={{
                    flex: 1,
                    cursor: 'pointer',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {j.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Canvas 3D */}
        <div ref={mountRef} style={{ flex: 1, height: '100%' }} />

        {/* Panel Derecho: Detalles */}
        <div style={{ width: '240px', background: '#18181b', padding: '15px', borderLeft: '1px solid #27272a', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', textTransform: 'uppercase', color: '#71717a' }}>Detalles</h4>
            <div style={{ marginBottom: '8px', color: '#a1a1aa' }}>Vértices: <strong style={{ color: '#fff' }}>{stats.vertices.toLocaleString()}</strong></div>
            <div style={{ marginBottom: '8px', color: '#a1a1aa' }}>Triángulos: <strong style={{ color: '#fff' }}>{stats.triangles.toLocaleString()}</strong></div>
          </div>

          {/* Editor de Posición de Pivote */}
          {selectedJoint && transformMode === 'pivot' && (
            <div style={{ borderTop: '1px solid #27272a', paddingTop: '15px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase', color: '#60a5fa' }}>
                Ajustar Pivote: {selectedJoint.name}
              </h4>
              {(['x', 'y', 'z'] as const).map((axis) => (
                <div key={axis} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#d4d4d8', marginBottom: '4px' }}>
                    <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>Eje {axis}:</span>
                    <span>{pivotOffset[axis].toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="-5"
                    max="5"
                    step="0.05"
                    value={pivotOffset[axis]}
                    onChange={(e) => updatePivotOffset(axis, parseFloat(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}