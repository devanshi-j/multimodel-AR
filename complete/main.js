import { loadGLTF } from "../libs/loader.js";
import * as THREE from '../libs/three123/three.module.js';
import { ARButton } from '../libs/jsm/ARButton.js';

let model = null;
let selectedPart = null;
let textureManager = document.getElementById('texture-manager');
let replaceButton = document.getElementById('replace-button');
let removeButton = document.getElementById('remove-button');
let textureList = document.getElementById('texture-list');

const initialTextures = {
    'part1': '../assets/models/coffee-table/textures/Old_Steel_normal.png',
    'part2': '../assets/models/coffee-table/textures/Old_Stell_specularGlossiness.png',
    'part3': '../assets/models/coffee-table/textures/Table_wood_1_diffuse.jpeg',
    'part4': '../assets/models/coffee-table/textures/Table_wood_1_normal.jpeg'
   
};

const optionTextures = [
    '../assets/models/textures/tx1.jpg',
    '../assets/models/textures/tx1.jpg',
    '../assets/models/textures/tx1.jpg'
    // Add more option textures as needed
];

// Apply initial textures to the model parts
const applyInitialTextures = () => {
    if (model && model.scene) {
        model.scene.traverse((child) => {
            if (child.isMesh) {
                const textureURL = initialTextures[child.name];
                if (textureURL) {
                    const loader = new THREE.TextureLoader();
                    loader.load(textureURL, (texture) => {
                        child.material.map = texture;
                        child.material.needsUpdate = true;
                    });
                }
            }
        });
    }
};

const applyTexture = (textureURL) => {
    if (selectedPart) {
        const loader = new THREE.TextureLoader();
        loader.load(textureURL, (texture) => {
            selectedPart.material.map = texture;
            selectedPart.material.needsUpdate = true;
        });
    }
};

const removeTexture = () => {
    if (selectedPart) {
        selectedPart.material.map = null;
        selectedPart.material.needsUpdate = true;
    }
};

const showTextureList = () => {
    textureList.style.display = 'block';
};

const onTextureImageClick = (textureURL) => {
    applyTexture(textureURL);
    textureList.style.display = 'none';
};

// Add option textures to the list dynamically
document.addEventListener('DOMContentLoaded', () => {
    optionTextures.forEach(texturePath => {
        const img = document.createElement('img');
        img.src = texturePath;
        img.onclick = () => onTextureImageClick(texturePath);
        textureList.appendChild(img);
    });

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

        model = await loadGLTF('../assets/models/coffee-table/scene.gltf');
        normalizeModel(model.scene, 0.5);
        const coffeeTable = new THREE.Group();
        coffeeTable.add(model.scene);
        coffeeTable.visible = false;
        scene.add(coffeeTable);

        // Apply initial textures
        applyInitialTextures();

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

                if (hitTestResults.length && !coffeeTable.visible) {
                    const hit = hitTestResults[0];
                    const hitPose = hit.getPose(referenceSpace);

                    coffeeTable.visible = true;
                    coffeeTable.position.setFromMatrixPosition(new THREE.Matrix4().fromArray(hitPose.transform.matrix));
                }

                // Handle interactions with the placed coffee table
                if (touchDown && coffeeTable.visible) {
                    const newPosition = controller.position.clone();
                    if (prevTouchPosition) {
                        const deltaX = newPosition.x - prevTouchPosition.x;
                        coffeeTable.rotation.y += deltaX * 6.0; // Faster rotation
                    }
                    prevTouchPosition = newPosition;
                }

                // Handling two-finger dragging
                if (isDraggingWithTwoFingers && coffeeTable.visible) {
                    const sources = session.inputSources;
                    const currentFingerPositions = [
                        new THREE.Vector3(sources[0].gamepad.axes[0], sources[0].gamepad.axes[1], 0),
                        new THREE.Vector3(sources[1].gamepad.axes[0], sources[1].gamepad.axes[1], 0)
                    ];

                    const deltaX = (currentFingerPositions[0].x - initialFingerPositions[0].x + currentFingerPositions[1].x - initialFingerPositions[1].x) / 2;
                    const deltaY = (currentFingerPositions[0].y - initialFingerPositions[0].y + currentFingerPositions[1].y - initialFingerPositions[1].y) / 2;

                    coffeeTable.position.x += deltaX;
                    coffeeTable.position.y += deltaY;

                    initialFingerPositions = currentFingerPositions;
                }

                // Handling pinch to scale
                if (isPinching && coffeeTable.visible && initialDistance !== null) {
                    const sources = session.inputSources;
                    const currentDistance = Math.sqrt(
                        Math.pow(sources[0].gamepad.axes[0] - sources[1].gamepad.axes[0], 2) +
                        Math.pow(sources[0].gamepad.axes[1] - sources[1].gamepad.axes[1], 2)
                    );
                    const scaleChange = currentDistance / initialDistance;
                    coffeeTable.scale.multiplyScalar(scaleChange);

                    initialDistance = currentDistance;
                }

                // Render the scene
                renderer.render(scene, camera);
            });
        });

        // Set up replace and remove button handlers
        replaceButton.addEventListener('click', () => {
            textureList.style.display = 'block';
        });

        removeButton.addEventListener('click', () => {
            removeTexture();
        });
    };

    initialize();
});
