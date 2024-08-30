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
            0: {
                name: 'Old_Steel_normal',
                preview: '../assets/models/coffee-table/textures/Old_Steel_normal.png',
                texture: '../assets/models/coffee-table/textures/Old_Steel_normal.png'
            },
            1: {
                name: 'Table_wood_1_diffuse',
                preview: '../assets/models/coffee-table/textures/Table_wood_1_diffuse.jpeg',
                texture: '../assets/models/coffee-table/textures/Table_wood_1_diffuse.jpeg'
            },
            2: {
                name: 'Old_Steel_specularGlossiness',
                preview: '../assets/models/coffee-table/textures/Old_Steel_specularGlossiness.png',
                texture: '../assets/models/coffee-table/textures/Old_Steel_specularGlossiness.png'
            },
            3: {
                name: 'Table_wood_1_normal',
                preview: '../assets/models/coffee-table/textures/Table_wood_1_normal.jpeg',
                texture: '../assets/models/coffee-table/textures/Table_wood_1_normal.jpeg'
            },
        };

        const newChoiceTextures = {
            0: '../assets/models/coffee-table/textures/tx1.jpg',
            1: '../assets/models/coffee-table/textures/tx2.jpg',
            2: '../assets/models/coffee-table/textures/tx3.jpg',
            3: '../assets/models/coffee-table/textures/tx4.jpg',
        };

        const textureButtonsContainer = document.getElementById('texture-buttons-container');
        const replaceRemoveButtons = document.getElementById('replace-remove-buttons');
        const newChoiceButtonsContainer = document.getElementById('new-choice-buttons-container');

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

        const replaceButton = document.getElementById('replace-button');
        replaceButton.addEventListener('click', () => {
            newChoiceButtonsContainer.style.display = 'block';
            newChoiceButtonsContainer.innerHTML = ''; // Clear previous buttons

            Object.keys(newChoiceTextures).forEach((index) => {
                const newTextureButton = document.createElement('img');
                newTextureButton.src = newChoiceTextures[index];
                newTextureButton.style.width = '80px';
                newTextureButton.style.height = '80px';
                newTextureButton.style.margin = '10px';
                newChoiceButtonsContainer.appendChild(newTextureButton);

                newTextureButton.addEventListener('click', () => {
                    if (selectedIndex !== null) {
                        const textureLoader = new THREE.TextureLoader();
                        coffeeTable.scene.traverse((child) => {
                            if (child.isMesh && child.material instanceof Array) {
                                const material = child.material[selectedIndex];
                                if (material) {
                                    material.map = textureLoader.load(newChoiceTextures[index]);
                                    material.needsUpdate = true;
                                }
                            }
                        });
                        replaceRemoveButtons.style.display = 'none';
                        newChoiceButtonsContainer.style.display = 'none';
                    }
                });
            });
        });

        const removeButton = document.getElementById('remove-button');
        removeButton.addEventListener('click', () => {
            if (selectedIndex !== null) {
                coffeeTable.scene.traverse((child) => {
                    if (child.isMesh && child.material instanceof Array) {
                        const material = child.material[selectedIndex];
                        if (material) {
                            material.map = null;
                            material.needsUpdate = true;
                        }
                    }
                });
                replaceRemoveButtons.style.display = 'none';
                newChoiceButtonsContainer.style.display = 'none';
            }
        });

        renderer.setAnimationLoop(() => {
            renderer.render(scene, camera);
        });
    };

    initialize();
});
