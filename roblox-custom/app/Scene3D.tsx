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
  originalMaterial: THREE.Material | THREE.Material[];
}

type RigStep = 'Head' | 'Torso' | 'LeftArm' | 'RightArm' | 'LeftLeg' | 'RightLeg';

const RIG_STEPS: { key: RigStep; title: string; description: string }[] = [
  { key: 'Head', title: '1. Cabeza y Accesorios/Pelo', description: 'Selecciona las partes de la cabeza y pulsa Vincular.' },
  { key: 'Torso', title: '2. Torso y Accesorios', description: 'Selecciona las partes del torso y pulsa Vincular.' },
  { key: 'LeftArm', title: '3. Brazo Izquierdo y Accesorios', description: 'Selecciona las partes del brazo izquierdo y pulsa Vincular.' },
  { key: 'RightArm', title: '4. Brazo Derecho y Accesorios', description: 'Selecciona las partes del brazo derecho y pulsa Vincular.' },
  { key: 'LeftLeg', title: '5. Pierna Izquierda y Calzado', description: 'Selecciona las partes de la pierna izquierda y pulsa Vincular.' },
  { key: 'RightLeg', title: '6. Pierna Derecha y Calzado', description: 'Selecciona las partes de la pierna derecha y pulsa Vincular.' },
];

export default function Scene3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [joints, setJoints] = useState<JointInfo[]>([]);
  const [selectedJointId, setSelectedJointId] = useState<string | null>(null);
  const [checkedJointIds, setCheckedJointIds] = useState<string[]>([]);
  const [stats, setStats] = useState({ vertices: 0, triangles: 0 });
  const [fileName, setFileName] = useState<string>('Ningún archivo cargado');

  const [showWizard, setShowWizard] = useState<boolean>(false);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);

  const [transformMode, setTransformMode] = useState<'rotate' | 'translate'>('rotate');

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rootCharacterGroupRef = useRef<THREE.Group | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const jointsRef = useRef<JointInfo[]>([]);
  const showWizardRef = useRef<boolean>(false);

  useEffect(() => {
    jointsRef.current = joints;
  }, [joints]);

  useEffect(() => {
    showWizardRef.current = showWizard;
    if (showWizard && transformControlsRef.current) {
      transformControlsRef.current.detach();
    }
  }, [showWizard]);

  // Material Azul de Resaltado
  const highlightMaterial = useRef(
    new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      side: THREE.DoubleSide
    })
  ).current;

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#222225');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 3, 10);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;

    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setMode('rotate');
    transformControlsRef.current = transformControls;

    // RENDERIZADO SUPERPUESTO (Evita que el personaje bloquee los clic en los aros/flechas)
    const helper = transformControls.getHelper();
    helper.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => {
            m.depthTest = false;
            m.depthWrite = false;
          });
        } else if (mesh.material) {
          mesh.material.depthTest = false;
          mesh.material.depthWrite = false;
        }
      }
    });

    transformControls.addEventListener('dragging-changed', (event) => {
      orbitControls.enabled = !event.value;
    });

    scene.add(helper);

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

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;

      const rect = mountRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / mountRef.current.clientWidth) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / mountRef.current.clientHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);

      if (rootCharacterGroupRef.current) {
        const intersects = raycaster.intersectObjects(rootCharacterGroupRef.current.children, true);
        if (intersects.length > 0) {
          const hitObject = intersects[0].object as THREE.Mesh;

          const foundJoint = jointsRef.current.find((j) => {
            if (j.mesh === hitObject) return true;
            let isInside = false;
            j.pivotGroup.traverse((child) => {
              if (child === hitObject) isInside = true;
            });
            return isInside;
          });

          if (foundJoint) {
            if (showWizardRef.current) {
              toggleCheckJoint(foundJoint.id);
            } else {
              selectJoint(foundJoint);
            }
          }
        }
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('pointerdown', handlePointerDown);

    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      orbitControls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      domElement.removeEventListener('pointerdown', handlePointerDown);
      cancelAnimationFrame(animId);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Iluminar una parte específica en azul
  const applyHighlight = (jointIdToHighlight: string | null) => {
    joints.forEach((j) => {
      const applyToMesh = (mesh: THREE.Mesh, isHighlighted: boolean) => {
        mesh.material = isHighlighted ? highlightMaterial : j.originalMaterial;
      };

      const isMatch = j.id === jointIdToHighlight;
      if (typeof j.pivotGroup.traverse === 'function') {
        j.pivotGroup.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            applyToMesh(child as THREE.Mesh, isMatch);
          }
        });
      } else {
        applyToMesh(j.mesh, isMatch);
      }
    });
  };

  // Iluminar múltiples partes seleccionadas en azul
  const applyHighlightMultiple = (jointIdsToHighlight: string[]) => {
    joints.forEach((j) => {
      const isChecked = jointIdsToHighlight.includes(j.id);
      const applyToMesh = (mesh: THREE.Mesh, isHighlighted: boolean) => {
        mesh.material = isHighlighted ? highlightMaterial : j.originalMaterial;
      };

      if (typeof j.pivotGroup.traverse === 'function') {
        j.pivotGroup.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            applyToMesh(child as THREE.Mesh, isChecked);
          }
        });
      } else {
        applyToMesh(j.mesh, isChecked);
      }
    });
  };

  const handleModeChange = (mode: 'rotate' | 'translate') => {
    setTransformMode(mode);
    if (!transformControlsRef.current || showWizard) return;
    transformControlsRef.current.setMode(mode);

    const selectedJoint = joints.find((j) => j.id === selectedJointId);
    if (selectedJoint) {
      transformControlsRef.current.attach(selectedJoint.pivotGroup);
    }
  };

  const selectJoint = (jointInfo: JointInfo) => {
    if (showWizard) return;
    setSelectedJointId(jointInfo.id);
    applyHighlight(jointInfo.id);

    if (transformControlsRef.current) {
      transformControlsRef.current.attach(jointInfo.pivotGroup);
    }
  };

  const clearSelection = () => {
    setSelectedJointId(null);
    applyHighlight(null);
    if (transformControlsRef.current) {
      transformControlsRef.current.detach();
    }
  };

  const toggleCheckJoint = (id: string) => {
    setCheckedJointIds((prev) => {
      const isChecking = !prev.includes(id);
      const updated = isChecking ? [...prev, id] : prev.filter((item) => item !== id);
      applyHighlightMultiple(updated);
      return updated;
    });
  };

  const handleConfirmStep = () => {
    const currentStep = RIG_STEPS[currentStepIdx];
    if (checkedJointIds.length > 0) {
      groupJointsByLimb(currentStep.key, checkedJointIds);
    }

    setCheckedJointIds([]);
    applyHighlight(null);

    if (currentStepIdx + 1 < RIG_STEPS.length) {
      setCurrentStepIdx(currentStepIdx + 1);
    } else {
      setShowWizard(false);
    }
  };

  // CALCULO CORRECTO DE PIVOTES SEGÚN EXTREMIDAD
  const groupJointsByLimb = (limbKey: string, jointIdsToGroup: string[]) => {
    const selectedJointsToGroup = joints.filter((j) => jointIdsToGroup.includes(j.id));
    const remainingJoints = joints.filter((j) => !jointIdsToGroup.includes(j.id));

    if (selectedJointsToGroup.length === 0) return;

    const groupContainer = new THREE.Group();
    groupContainer.name = `Group_${limbKey}`;

    const box = new THREE.Box3();
    selectedJointsToGroup.forEach((j) => box.expandByObject(j.pivotGroup));
    const center = box.getCenter(new THREE.Vector3());

    // Posicionamiento preciso del pivote
    if (limbKey.includes('Arm') || limbKey.includes('Leg')) {
      center.y = box.max.y; // Articulación superior (hombros / cadera)
    } else if (limbKey.includes('Head')) {
      center.y = box.min.y; // Base del cuello
    }

    groupContainer.position.copy(center);

    selectedJointsToGroup.forEach((j) => {
      j.pivotGroup.position.sub(center);
      groupContainer.add(j.pivotGroup);
    });

    if (rootCharacterGroupRef.current) {
      rootCharacterGroupRef.current.add(groupContainer);
    }

    const newGroupJoint: JointInfo = {
      id: `joint_group_${limbKey}_${Date.now()}`,
      name: `🦴 ${limbKey} (${selectedJointsToGroup.length} partes)`,
      pivotGroup: groupContainer,
      mesh: selectedJointsToGroup[0].mesh,
      originalMaterial: selectedJointsToGroup[0].originalMaterial
    };

    setJoints([newGroupJoint, ...remainingJoints]);
  };

  const createJointNode = (mesh: THREE.Mesh): THREE.Group => {
    const pivotGroup = new THREE.Group();
    pivotGroup.name = `Pivot_${mesh.name || 'Part'}`;

    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());

    pivotGroup.position.copy(center);
    mesh.position.sub(center);
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
      const origMat = texturedMaterial || defaultMaterial;
      mesh.material = origMat;

      const pivotGroup = createJointNode(mesh);
      mainCharacterGroup.add(pivotGroup);

      const jointId = `joint_${index}_${mesh.name || 'Part'}`;
      jointList.push({
        id: jointId,
        name: mesh.name || `Parte ${index + 1}`,
        pivotGroup: pivotGroup,
        mesh: mesh,
        originalMaterial: origMat
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

    setCurrentStepIdx(0);
    setShowWizard(true);
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

  const currentStep = RIG_STEPS[currentStepIdx];

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

        {!showWizard && joints.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
        
        {/* Panel Izquierdo */}
        <div style={{ width: '280px', background: '#18181b', padding: '15px', overflowY: 'auto', borderRight: '1px solid #27272a', zIndex: 10 }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', textTransform: 'uppercase', color: '#71717a' }}>
            Partes Disponibles ({joints.length})
          </h4>
          <p style={{ fontSize: '11px', color: '#a1a1aa', margin: '0 0 12px 0' }}>
            {showWizard
              ? `Haz clic en las partes en la lista o en el visor 3D para marcar/desmarcar:`
              : 'Haz clic en cualquier parte en el visor 3D para moverla directamente:'}
          </p>
          {joints.map((j) => {
            const isSelected = j.id === selectedJointId;
            const isChecked = checkedJointIds.includes(j.id);

            return (
              <div
                key={j.id}
                onClick={() => {
                  if (showWizard) {
                    toggleCheckJoint(j.id);
                  } else {
                    selectJoint(j);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  fontSize: '12px',
                  color: isSelected ? '#fff' : '#d4d4d8',
                  backgroundColor: isSelected ? '#2563eb' : isChecked ? '#1e293b' : 'transparent',
                  borderRadius: '6px',
                  marginBottom: '4px',
                  border: isSelected ? '1px solid #60a5fa' : isChecked ? '1px solid #3b82f6' : '1px solid transparent',
                  cursor: 'pointer'
                }}
              >
                {showWizard && (
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleCheckJoint(j.id);
                    }}
                    style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                  />
                )}
                <span
                  style={{
                    flex: 1,
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    fontWeight: isSelected || isChecked ? 'bold' : 'normal'
                  }}
                >
                  {j.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Canvas 3D Central */}
        <div ref={mountRef} style={{ flex: 1, height: '100%' }} />

        {/* Panel Derecho */}
        <div style={{ width: '280px', background: '#18181b', padding: '15px', borderLeft: '1px solid #27272a', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto' }}>
          
          {showWizard && (
            <div style={{
              backgroundColor: '#27272a',
              border: '2px solid #3b82f6',
              borderRadius: '10px',
              padding: '14px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
            }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#60a5fa' }}>
                🛠️ Agrupar Partes ({currentStepIdx + 1}/{RIG_STEPS.length})
              </h3>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#fff' }}>
                {currentStep?.title}
              </h4>
              <p style={{ margin: '0 0 12px 0', fontSize: '11px', color: '#a1a1aa' }}>
                {currentStep?.description}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={handleConfirmStep}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  Vincular y Siguiente ➔
                </button>
                <button
                  onClick={() => {
                    setCheckedJointIds([]);
                    applyHighlight(null);
                    if (currentStepIdx + 1 < RIG_STEPS.length) {
                      setCurrentStepIdx(currentStepIdx + 1);
                    } else {
                      setShowWizard(false);
                    }
                  }}
                  style={{
                    backgroundColor: '#3f3f46',
                    color: '#d4d4d8',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  Omitir Paso
                </button>
              </div>
            </div>
          )}

          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', textTransform: 'uppercase', color: '#71717a' }}>Detalles</h4>
            <div style={{ marginBottom: '8px', color: '#a1a1aa' }}>Vértices: <strong style={{ color: '#fff' }}>{stats.vertices.toLocaleString()}</strong></div>
            <div style={{ marginBottom: '8px', color: '#a1a1aa' }}>Triángulos: <strong style={{ color: '#fff' }}>{stats.triangles.toLocaleString()}</strong></div>
          </div>
        </div>

      </div>

    </div>
  );
}