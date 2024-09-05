import { loadGLTF } from "../libs/loader.js";
import * as THREE from '../libs/three123/three.module.js';
import { ARButton } from '../libs/jsm/ARButton.js';

const normalizeModel = (obj, height) => {
    const bbox = new THREE.Box3().setFromObject(obj);
    const size = bbox.getSize(new THREE.Vector3());
    obj.scale.multiplyScalar(height / size.y);

    const bbox2 = new THREE.Box3().setFromObject(obj);
    const center = bbox2.getCenter(new THREE.Vector3());
    obj.position.set(-center.x, -center.y, -center.z);
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

        const model = await loadGLTF('../assets/models/coffee-table/scene.gltf');
        normalizeModel(model.scene, 0.5);
        const chair = new THREE.Group();
        chair.add(model.scene);
        chair.visible = false;
        scene.add(chair);

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
                    initialDistance = Math.sqrt(
                        Math.pow(sources[0].gamepad.axes[0] - sources[1].gamepad.axes[0], 2) +
                        Math.pow(sources[0].gamepad.axes[1] - sources[1].gamepad.axes[1], 2)
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

                if (hitTestResults.length && !chair.visible) {
                    const hit = hitTestResults[0];
                    const hitPose = hit.getPose(referenceSpace);

                    chair.visible = true;
                    chair.position.setFromMatrixPosition(new THREE.Matrix4().fromArray(hitPose.transform.matrix));
                }

                // Handle interactions with the placed chair
                if (touchDown && chair.visible) {
                    const newPosition = controller.position.clone();
                    if (prevTouchPosition) {
                        const deltaX = newPosition.x - prevTouchPosition.x;
                        chair.rotation.y += deltaX * 6.0; // Faster rotation
                    }
                    prevTouchPosition = newPosition;
                }

                // Handling two-finger dragging
                if (isDraggingWithTwoFingers && chair.visible) {
                    const sources = session.inputSources;
                    const currentFingerPositions = [
                        new THREE.Vector3(sources[0].gamepad.axes[0], sources[0].gamepad.axes[1], 0),
                        new THREE.Vector3(sources[1].gamepad.axes[0], sources[1].gamepad.axes[1], 0)
                    ];

                    const deltaX = (currentFingerPositions[0].x - initialFingerPositions[0].x + currentFingerPositions[1].x - initialFingerPositions[1].x) / 2;
                    const deltaY = (currentFingerPositions[0].y - initialFingerPositions[0].y + currentFingerPositions[1].y - initialFingerPositions[1].y) / 2;

                    chair.position.x += deltaX;
                    chair.position.y += deltaY;

                    initialFingerPositions = currentFingerPositions;
                }

                // Handling pinch to scale
                if (isPinching && chair.visible && initialDistance !== null) {
                    const sources = session.inputSources;
                    const currentDistance = Math.sqrt(
                        Math.pow(sources[0].gamepad.axes[0] - sources[1].gamepad.axes[0], 2) +
                        Math.pow(sources[0].gamepad.axes[1] - sources[1].gamepad.axes[1], 2)
                    );
                    const scaleChange = currentDistance / initialDistance;
                    chair.scale.multiplyScalar(scaleChange);

                    initialDistance = currentDistance;
                }

                // Render the scene
                renderer.render(scene, camera);
            });
        });
    };

    initialize();
});
