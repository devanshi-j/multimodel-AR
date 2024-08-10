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

const setOpacity = (obj, opacity) => {
    obj.children.forEach((child) => {
        setOpacity(child, opacity);
    });
    if (obj.material) {
        obj.material.format = THREE.RGBAFormat;
        obj.material.opacity = opacity;
    }
};

const deepClone = (obj) => {
    const newObj = obj.clone();
    newObj.traverse((o) => {
        if (o.isMesh) {
            o.material = o.material.clone();
        }
    });
    return newObj;
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

        const itemNames = ['chair', 'coffee-table', 'cushion'];
        const itemHeights = [0.5, 0.7, 0.05];
        const items = [];
        const placedItems = [];

        for (let i = 0; i < itemNames.length; i++) {
            const model = await loadGLTF(`../assets/models/${itemNames[i]}/scene.gltf`);
            normalizeModel(model.scene, itemHeights[i]);
            const item = new THREE.Group();
            item.add(model.scene);
            item.visible = false;
            setOpacity(item, 0.5);
            items.push(item);
            scene.add(item);
        }

        let selectedItem = null;
        let prevTouchPosition = null;
        let touchDown = false;

        const itemButtons = document.querySelector("#item-buttons");
        const confirmButtons = document.querySelector("#confirm-buttons");
        itemButtons.style.display = "block";
        confirmButtons.style.display = "none";

        const select = (selectItem) => {
            items.forEach((item) => {
                item.visible = item === selectItem;
            });
            selectedItem = selectItem;
            itemButtons.style.display = "none";
            confirmButtons.style.display = "block";
        };

        const cancelSelect = () => {
            itemButtons.style.display = "block";
            confirmButtons.style.display = "none";
            if (selectedItem) {
                selectedItem.visible = false;
            }
            selectedItem = null;
        };

        const placeButton = document.querySelector("#place");
        const cancelButton = document.querySelector("#cancel");

        cancelButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            cancelSelect();
        });

        items.forEach((item, i) => {
            const el = document.querySelector(`#item${i}`);
            el.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                select(item);
            });
        });

        placeButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (selectedItem) {
                const spawnItem = deepClone(selectedItem);
                setOpacity(spawnItem, 1.0);
                scene.add(spawnItem);
                placedItems.push(spawnItem);
                cancelSelect();
            }
        });

        const controller = renderer.xr.getController(0);
        scene.add(controller);

        let isDragging = false;
        let initialDistance = null;
        let initialScale = null;

        controller.addEventListener('selectstart', () => {
            touchDown = true;
            if (placedItems.length > 0) {
                isDragging = true;
                initialDistance = null;
                initialScale = placedItems[0].scale.clone();
            }
        });

        controller.addEventListener('selectend', () => {
            touchDown = false;
            isDragging = false;
            initialDistance = null;
        });

        renderer.xr.addEventListener("sessionstart", async () => {
            const session = renderer.xr.getSession();
            const referenceSpace = await session.requestReferenceSpace("local-floor");
                       const hitTestSource = await session.requestHitTestSource({ space: referenceSpace });

            renderer.setAnimationLoop((timestamp, frame) => {
                if (!frame) return;

                const hitTestResults = frame.getHitTestResults(hitTestSource);
                const referenceSpace = renderer.xr.getReferenceSpace();

                // Update item positions and visibility based on hit test results
                if (hitTestResults.length) {
                    const hit = hitTestResults[0];
                    const position = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(hit.getPose(referenceSpace).transform.matrix));

                    placedItems.forEach((item) => {
                        item.visible = true; // Ensure items remain visible
                        item.position.copy(position); // Move the item to the hit position
                    });
                } else {
                    // Only hide the item if it's not being dragged
                    if (!isDragging) {
                        placedItems.forEach((item) => {
                            item.visible = false; // Hide if there are no hit test results
                        });
                    }
                }

                // Dragging and scaling logic
                if (isDragging) {
                    if (hitTestResults.length) {
                        const hit = hitTestResults[0];
                        const position = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(hit.getPose(referenceSpace).transform.matrix));

                        // Move all placed items
                        placedItems.forEach((item) => {
                            item.position.copy(position);
                        });

                        if (initialDistance === null) {
                            const position1 = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
                            const position2 = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld); // Use second controller if available
                            initialDistance = position1.distanceTo(position2);
                        } else {
                            const currentPosition1 = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
                            const currentPosition2 = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld); // Use second controller if available
                            const currentDistance = currentPosition1.distanceTo(currentPosition2);
                            const scaleFactor = currentDistance / initialDistance;

                            // Scale all placed items
                            placedItems.forEach((item) => {
                                item.scale.copy(initialScale).multiplyScalar(scaleFactor);
                            });
                        }
                    }
                }

                // Rotate items if touched
                if (touchDown) {
                    const viewerMatrix = new THREE.Matrix4().fromArray(frame.getViewerPose(referenceSpace).transform.inverse.matrix);
                    const newPosition = controller.position.clone();
                    newPosition.applyMatrix4(viewerMatrix);
                    if (prevTouchPosition) {
                        const deltaX = newPosition.x - prevTouchPosition.x;
                        placedItems.forEach((item) => {
                            item.rotation.y += deltaX * 30; // Rotate based on the change in position
                        });
                    }
                    prevTouchPosition = newPosition;
                }

                renderer.render(scene, camera);
            });
        });
    };

    initialize();
});
