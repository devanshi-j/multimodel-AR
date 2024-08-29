import { loadGLTF } from "../libs/loader.js";
import * as THREE from '../libs/three123/three.module.js';
import { ARButton } from '../libs/jsm/ARButton.js';

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

        const coffeeTable = await loadGLTF('../assets/models/coffee-table/scene.gltf');
        scene.add(coffeeTable.scene);

        const materialIndices = {
            0: { // Index of the material
                name: 'Old_Steel_normal',
                preview: '../assets/texture_previews/Old_Steel_normal_preview.png',
                texture: '../assets/models/coffee-table/textures/Old_Steel_normal.png'
            },
            1: { // Index of the material
                name: 'Table_wood_1_diffuse',
                preview: '../assets/texture_previews/Table_wood_1_diffuse_preview.png',
                texture: '../assets/models/coffee-table/textures/Table_wood_1_diffuse.jpeg'
            },
            // Add more indices as needed
        };

        const textureButtonsContainer = document.createElement('div');
        textureButtonsContainer.style.position = 'absolute';
        textureButtonsContainer.style.bottom = '20px';
        textureButtonsContainer.style.left = '50%';
        textureButtonsContainer.style.transform = 'translateX(-50%)';
        document.body.appendChild(textureButtonsContainer);

        const replaceRemoveButtons = document.createElement('div');
        replaceRemoveButtons.style.display = 'none'; // Hidden by default
        replaceRemoveButtons.style.position = 'absolute';
        replaceRemoveButtons.style.top = '50%';
        replaceRemoveButtons.style.left = '50%';
        replaceRemoveButtons.style.transform = 'translate(-50%, -50%)';
        document.body.appendChild(replaceRemoveButtons);

        let selectedIndex = null;

        Object.keys(materialIndices).forEach((index) => {
            const textureInfo = materialIndices[index];

            const textureButton = document.createElement('img');
            textureButton.src = textureInfo.preview;
            textureButton.style.width = '80px';
            textureButton.style.height = '80px';
            textureButton.style.margin = '10px';
            textureButtonsContainer.appendChild(textureButton);

            textureButton.addEventListener('click', () => {
                replaceRemoveButtons.style.display = 'block';
                selectedIndex = index;
            });
        });

        const replaceButton = document.createElement('button');
        replaceButton.innerText = 'Replace Texture';
        replaceButton.addEventListener('click', () => {
            if (selectedIndex !== null) {
                const textureLoader = new THREE.TextureLoader();
                coffeeTable.scene.traverse((child) => {
                    if (child.isMesh && child.material instanceof Array) {
                        const material = child.material[selectedIndex];
                        if (material) {
                            material.map = textureLoader.load(materialIndices[selectedIndex].texture);
                            material.needsUpdate = true;
                        }
                    }
                });
                replaceRemoveButtons.style.display = 'none';
            }
        });
        replaceRemoveButtons.appendChild(replaceButton);

        const removeButton = document.createElement('button');
        removeButton.innerText = 'Remove Texture';
        removeButton.addEventListener('click', () => {
            if (selectedIndex !== null) {
                coffeeTable.scene.traverse((child) => {
                    if (child.isMesh && child.material instanceof Array) {
                        const material = child.material[selectedIndex];
                        if (material) {
                            material.map = null; // Remove the texture
                            material.needsUpdate = true;
                        }
                    }
                });
                replaceRemoveButtons.style.display = 'none';
            }
        });
        replaceRemoveButtons.appendChild(removeButton);

        renderer.setAnimationLoop(() => {
            renderer.render(scene, camera);
        });
    };

    initialize();
});
