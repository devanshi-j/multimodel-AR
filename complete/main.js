import { loadGLTF } from "../libs/loader.js";
import * as THREE from '../libs/three123/three.module.js';
import { ARButton } from '../libs/jsm/ARButton.js';

const normalizeModel = (obj, height) => {
    // Scale it according to height
    const bbox = new THREE.Box3().setFromObject(obj);
    const size = bbox.getSize(new THREE.Vector3());
    obj.scale.multiplyScalar(height / size.y);

    // Reposition to center
    const bbox2 = new THREE.Box3().setFromObject(obj);
    const center = bbox2.getCenter(new THREE.Vector3());
    obj.position.set(-center.x, -center.y, -center.z);
};

// Recursively set opacity
const setOpacity = (obj, opacity) => {
    obj.children.forEach((child) => {
        setOpacity(child, opacity);
    });
    if (obj.material) {
        obj.material.format = THREE.RGBAFormat; // Required for opacity
        obj.material.opacity = opacity;
    }
};

// Make clone object not sharing materials
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

        const itemNames = ['coffee-table', 'chair', 'cushion'];
        const itemHeights = [0.5, 0.7, 0.05];
        const items = [];
        const placedItems = []; // Array to store placed items

        // Load models
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

        // Cancel selection logic before placing
        cancelButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            cancelSelect(); // Cancel selection
        });

        // Item button listeners
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
                placedItems.push(spawnItem); // Add to placedItems array
                cancelSelect(); // Reset selection after placement
            }
        });

        // Controller and interaction logic...
        const controller = renderer.xr.getController(0);
        scene.add(controller);

        let isDragging = false;
        let initialDistance = null;
        let initialScale = null;

        // Start touch event listeners
        controller.addEventListener('selectstart', () => {
            touchDown = true;
            // Start dragging
            if (placedItems.length > 0) {
                isDragging = true;
                // Initialize scale
                initialDistance = null;
                initialScale = placedItems[0].scale.clone(); // Store the initial scale of the first placed item
            }
        });

        controller.addEventListener('selectend', () => {
            touchDown = false;
            isDragging = false;
            initialDistance = null; // Reset distance on end
        });

        // Start session
        renderer.xr.addEventListener("sessionstart", async () => {
            const session = renderer.xr.getSession();
            const viewerReferenceSpace = await session.requestReferenceSpace("viewer");
            const hitTestSource = await session.requestHitTestSource({ space: viewerReferenceSpace });

            renderer.setAnimationLoop((timestamp, frame) => {
                if (!frame) return;

                const referenceSpace = renderer.xr.getReferenceSpace();
                const hitTestResults = frame.getHitTestResults(hitTestSource);

                // Update item positions and visibility
                placedItems.forEach((item) => {
                    if (hitTestResults.length) {
                        const hit = hitTestResults[0];
                        item.visible = true;
                        item.position.setFromMatrixPosition(new THREE.Matrix4().fromArray(hit.getPose(referenceSpace).transform.matrix));
                    } else {
                        item.visible = false;
                    }
                });

                // Dragging and scaling logic
                if (isDragging) {
                    if (hitTestResults.length) {
                        const hit = hitTestResults[0];
                        const position = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(hit.getPose(referenceSpace).transform.matrix));

                        // Move all placed items
                        placedItems.forEach((item) => {
                            item.position.copy(position); // Move the placed item
                        });

                        if (initialDistance === null) {
                            // Calculate initial distance if it's the first frame of drag
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
                    newPosition.applyMatrix4(viewerMatrix); // Change to viewer coordinate
                    if (prevTouchPosition) {
                        const deltaX = newPosition.x - prevTouchPosition.x;
                        placedItems.forEach((item) => {
                            item.rotation.y += deltaX * 30;
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
