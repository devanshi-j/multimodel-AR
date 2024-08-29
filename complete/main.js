import { loadGLTF } from "../libs/loader.js";
import * as THREE from '../libs/three123/three.module.js';
import { ARButton } from '../libs/jsm/ARButton.js';

const normalizeModel = (obj, height) => {
    const bbox = new THREE.Box3().setFromObject(obj);
    const size = bbox.getSize(new THREE.Vector3());
    const scale = height / size.y;

    // Centering the object
    const center = bbox.getCenter(new THREE.Vector3());
    obj.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    obj.scale.multiplyScalar(scale);
};

document.addEventListener('DOMContentLoaded', () => {
    const initialize = async () => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

        const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
        scene.add(light);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true;

        const arButton = ARButton.createButton(renderer, { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: document.body } });
        document.body.appendChild(renderer.domElement);
        document.body.appendChild(arButton);

        // Placeholder for model loading
        const modelContainer = document.createElement('div');
        modelContainer.id = 'modelContainer';
        modelContainer.style.width = '100%';
        modelContainer.style.height = '100%';
        modelContainer.style.backgroundColor = 'rgba(0,0,0,0.5)'; // Semi-transparent background
        modelContainer.innerHTML = '<p style="color: white; text-align: center; margin-top: 50%;">Loading model...</p>';
        document.body.appendChild(modelContainer);

        const textureLoader = new THREE.TextureLoader();
        const chairGroup = new THREE.Group();
        chairGroup.visible = false;
        scene.add(chairGroup);

        const updateTexture = (textureUrl) => {
            textureLoader.load(textureUrl, (texture) => {
                chairGroup.traverse((child) => {
                    if (child.isMesh) {
                        child.material.map = texture;
                        child.material.needsUpdate = true;
                    }
                });
            });
        };

        const updateColor = (color) => {
            chairGroup.traverse((child) => {
                if (child.isMesh) {
                    child.material.color.set(color);
                }
            });
        };

        document.getElementById('textureSelect').addEventListener('change', (event) => {
            const selectedTexture = event.target.value;
            updateTexture(`../assets/textures/${selectedTexture}`);
        });

        document.getElementById('colorPicker').addEventListener('input', (event) => {
            const selectedColor = event.target.value;
            updateColor(selectedColor);
        });

        const loadModel = async () => {
            try {
                const model = await loadGLTF('../assets/models/coffee-table/scene.gltf');
                normalizeModel(model.scene, 0.5);
                chairGroup.add(model.scene);
                modelContainer.style.display = 'none'; // Hide loading placeholder
                chairGroup.visible = true;
            } catch (error) {
                console.error('Error loading model:', error);
                modelContainer.innerHTML = '<p style="color: red; text-align: center;">Failed to load model</p>';
            }
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    loadModel();
                    observer.unobserve(entry.target); // Stop observing after loading
                }
            });
        }, { threshold: 0.1 });

        observer.observe(modelContainer);

        let prevTouchPosition = null;
        let touchDown = false;
        let isPinching = false;
        let initialDistance = null;
        let isDraggingWithTwoFingers = false;
        let initialFingerPositions = [];

        const raycaster = new THREE.Raycaster();
        const controller = renderer.xr.getController(0);
        scene.add(controller);

        controller.addEventListener('selectstart', () => {
            touchDown = true;
        });

        controller.addEventListener('selectend', () => {
            touchDown = false;
            prevTouchPosition = null;
        });

        renderer.xr.addEventListener("sessionstart", async () => {
            const session = renderer.xr.getSession();
            const viewerReferenceSpace = await session.requestReferenceSpace("viewer");
            const hitTestSource = await session.requestHitTestSource({ space: viewerReferenceSpace });

            session.addEventListener('inputsourceschange', () => {
                const sources = session.inputSources;
                if (sources.length === 2) {
                    isPinching = true;
                    initialDistance = Math.hypot(
                        sources[0].gamepad.axes[0] - sources[1].gamepad.axes[0],
                        sources[0].gamepad.axes[1] - sources[1].gamepad.axes[1]
                    );
                    isDraggingWithTwoFingers = true;
                    initialFingerPositions = [
                        new THREE.Vector3(sources[0].gamepad.axes[0], sources[0].gamepad.axes[1], 0),
                        new THREE.Vector3(sources[1].gamepad.axes[0], sources[1].gamepad.axes[1], 0)
                    ];
                } else {
                    isPinching = false;
                    isDraggingWithTwoFingers = false;
                    initialDistance = null;
                    initialFingerPositions = [];
                }
            });

            renderer.setAnimationLoop((timestamp, frame) => {
                if (!frame) return;

                const referenceSpace = renderer.xr.getReferenceSpace();
                const hitTestResults = frame.getHitTestResults(hitTestSource);

                if (hitTestResults.length && chairGroup.visible) {
                    const hit = hitTestResults[0];
                    const hitPose = hit.getPose(referenceSpace);

                    chairGroup.position.setFromMatrixPosition(new THREE.Matrix4().fromArray(hitPose.transform.matrix));
                }

                // Handle interactions with the placed chair
                if (touchDown && chairGroup.visible) {
                    const newPosition = controller.position.clone();
                    if (prevTouchPosition) {
                        const deltaX = newPosition.x - prevTouchPosition.x;
                        chairGroup.rotation.y += deltaX * 6.0; // Faster rotation
                    }
                    prevTouchPosition = newPosition;
                }

                // Handling two-finger dragging
                if (isDraggingWithTwoFingers && chairGroup.visible) {
                    const sources = session.inputSources;
                    const currentFingerPositions = [
                        new THREE.Vector3(sources[0].gamepad.axes[0], sources[0].gamepad.axes[1], 0),
                        new THREE.Vector3(sources[1].gamepad.axes[0], sources[1].gamepad.axes[1], 0)
                    ];

                    const deltaX = (currentFingerPositions[0].x - initialFingerPositions[0].x + currentFingerPositions[1].x - initialFingerPositions[1].x) / 2;
                    const deltaY = (currentFingerPositions[0].y - initialFingerPositions[0].y + currentFingerPositions[1].y - initialFingerPositions[1].y) / 2;

                    chairGroup.position.x += deltaX;
                    chairGroup.position.y += deltaY;

                    initialFingerPositions = currentFingerPositions;
                }

                // Handling pinch to scale
                if (isPinching && chairGroup.visible && initialDistance !== null) {
                    const sources = session.inputSources;
                    const currentDistance = Math.hypot(
                        sources[0].gamepad.axes[0] - sources[1].gamepad.axes[0],
                        sources[0].gamepad.axes[1] - sources[1].gamepad.axes[1]
                    );
                    const scaleChange = currentDistance / initialDistance;
                    chairGroup.scale.multiplyScalar(scaleChange);

                    initialDistance = currentDistance;
                }

                // Render the scene
                renderer.render(scene, camera);
            });
        });
    };

    initialize();
});
