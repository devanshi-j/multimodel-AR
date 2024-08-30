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

        // Material indices and initial textures
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

        // New choice textures for replacement
        const newChoiceTextures = {
            0: '../assets/models/coffee-table/textures/tx1.jpg',
            1: '../assets/models/coffee-table/textures/tx2.jpg',
            2: '../assets/models/coffee-table/textures/tx3.jpg',
            3: '../assets/models/coffee-table/textures/tx3.jpg',
        };

        const textureManager = document.getElementById('texture-manager');
        const replaceButton = document.getElementById('replace-button');
        const removeButton = document.getElementById('remove-button');
        const textureList = document.getElementById('texture-list');

        let selectedIndex = null;

        // Display initial texture buttons
        Object.keys(materialIndices).forEach((index) => {
            const textureInfo = materialIndices[index];

            const textureButton = document.createElement('img');
            textureButton.src = textureInfo.preview;
            textureButton.style.width = '100px'; // Match the width defined in the CSS
            textureButton.style.height = '100px';
            textureList.appendChild(textureButton);

            textureButton.addEventListener('click', () => {
                selectedIndex = index;
                textureList.style.display = 'none';
                replaceButton.style.display = 'block';
                removeButton.style.display = 'block';
            });
        });

        // Replace texture functionality
        replaceButton.addEventListener('click', () => {
            textureList.innerHTML = ''; // Clear previous texture buttons

            Object.keys(newChoiceTextures).forEach((index) => {
                const newTextureButton = document.createElement('img');
                newTextureButton.src = newChoiceTextures[index];
                newTextureButton.style.width = '100px';
                newTextureButton.style.height = '100px';
                textureList.appendChild(newTextureButton);

                newTextureButton.addEventListener('click', () => {
                    if (selectedIndex !== null) {
                        const textureLoader = new THREE.TextureLoader();
                        coffeeTable.scene.traverse((child) => {
                            if (child.isMesh && Array.isArray(child.material)) {
                                const material = child.material[selectedIndex];
                                if (material) {
                                    material.map = textureLoader.load(newChoiceTextures[index]);
                                    material.needsUpdate = true;
                                }
                            }
                        });
                        replaceButton.style.display = 'none';
                        removeButton.style.display = 'none';
                        textureList.style.display = 'block';
                    }
                });
            });

            replaceButton.style.display = 'none'; // Hide the replace button
            removeButton.style.display = 'none'; // Hide the remove button
            textureList.style.display = 'block'; // Show new texture choices
        });

        // Remove texture functionality
        removeButton.addEventListener('click', () => {
            if (selectedIndex !== null) {
                coffeeTable.scene.traverse((child) => {
                    if (child.isMesh && Array.isArray(child.material)) {
                        const material = child.material[selectedIndex];
                        if (material) {
                            material.map = null; // Remove the texture
                            material.needsUpdate = true;
                        }
                    }
                });
                replaceButton.style.display = 'none';
                removeButton.style.display = 'none';
                textureList.style.display = 'block';
            }
        });

        renderer.setAnimationLoop(() => {
            renderer.render(scene, camera);
        });
    };

    initialize();
});
