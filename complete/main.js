import { loadGLTF } from "../libs/loader.js";
import * as THREE from '../libs/three123/three.module.js';
import { ARButton } from '../libs/jsm/ARButton.js';
import { DRACOLoader } from '../libs/jsm/DRACOLoader.js';
import { GLTFLoader } from '../libs/jsm/loaders/GLTFLoader.js';  // Correct import for GLTFLoader

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

        const chair = new THREE.Group(); // Empty group to hold the model
        chair.visible = false; // Keep hidden initially
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

        // Draco Loader Setup
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('../libs/');
        const loader = new GLTFLoader();  // Using the correctly imported GLTFLoader
        loader.setDRACOLoader(dracoLoader);

        let modelLoaded = false;

        // Preload the model before the AR session starts
        let model;
        try {
            model = await loadGLTF('../assets/models/coffee-table/scene.gltf');
            normalizeModel(model.scene, 0.5);
            chair.add(model.scene);
            modelLoaded = true; // Mark as loaded
        } catch (error) {
            console.error("Error loading model:", error);
        }

        renderer.xr.addEventListener("sessionstart", () => {
            if (modelLoaded) {
                // Place the chair immediately in front of the camera
                chair.visible = true;
                chair.position.set(0, 0, -1.5); // 1.5 units in front of the camera
                chair.scale.set(0.5, 0.5, 0.5); // Ensure appropriate scaling
            }

            renderer.setAnimationLoop(() => {
                renderer.render(scene, camera);
            });
        });
    };

    initialize();
});
