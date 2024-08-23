import { loadGLTF } from "../libs/loader.js";
import * as THREE from '../libs/three123/three.module.js';
import { ARButton } from '../libs/jsm/ARButton.js';

// Normalize model size and center it
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

        // Lighting
        const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
        scene.add(light);

        // Renderer setup
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true;
        document.body.appendChild(renderer.domElement);

        // AR button setup
        const arButton = ARButton.createButton(renderer, { 
            requiredFeatures: ['hit-test'], 
            optionalFeatures: ['dom-overlay'], 
            domOverlay: { root: document.body } 
        });
        document.body.appendChild(arButton);

        // Load and normalize model
        let model;
        try {
            model = await loadGLTF('../assets/models/coffee-table/scene.gltf');
        } catch (error) {
            console.error('Failed to load model:', error);
            return;
        }
        normalizeModel(model.scene, 0.5);

        // Create and add model to scene
        const coffeeTable = new THREE.Group();
        coffeeTable.add(model.scene);
        coffeeTable.visible = false; // Initially invisible
        scene.add(coffeeTable);

        // Textures setup
        const textureLoader = new THREE.TextureLoader();
        const oldTextures = {
            steelNormal: textureLoader.load('../assets/models/coffee-table/textures/Old_Steel_normal.png'),
            steelGloss: textureLoader.load('../assets/models/coffee-table/textures/Old_Steel_specularGlossiness.png'),
            woodDiffuse: textureLoader.load('../assets/models/coffee-table/textures/Table_wood_1_diffuse.jpeg'),
            woodNormal: textureLoader.load('../assets/models/coffee-table/textures/Table_wood_1_normal.jpeg')
        };
        const newTextures = {
            woodTx1: textureLoader.load('../assets/textures/tx1.jpg'),
            woodTx2: textureLoader.load('../assets/textures/tx2.jpg'),
            woodTx3: textureLoader.load('../assets/textures/tx3.jpg')
        };

        // Apply old textures to model
        model.scene.traverse(child => {
            if (child.isMesh && child.material && child.material.map) {
                const textureSrc = child.material.map.image.src.toLowerCase();

                if (textureSrc.includes('table_wood_1_diffuse')) {
                    child.material.map = oldTextures.woodDiffuse;
                } else if (textureSrc.includes('table_wood_1_normal')) {
                    child.material.map = oldTextures.woodNormal;
                } else if (textureSrc.includes('old_steel_normal')) {
                    child.material.map = oldTextures.steelNormal;
                } else if (textureSrc.includes('old_steel_specularglossiness')) {
                    child.material.map = oldTextures.steelGloss;
                }
            }
        });

        // UI Elements
        const textureImages = document.querySelectorAll('.texture-image');
        const replaceButton = document.getElementById('replace-button');
        const textureOptions = document.getElementById('texture-options');

        let selectedPart = null;

        // Select texture event listener
        textureImages.forEach(img => {
            img.addEventListener('click', () => {
                const textureName = img.getAttribute('data-texture');
                selectedPart = getPartWithTexture(model.scene, textureName);
                replaceButton.style.display = 'block';
            });
        });

        // Replace button event listener
        replaceButton.addEventListener('click', () => {
            textureOptions.style.display = 'block';
        });

        // Apply new texture event listener
        textureOptions.addEventListener('click', event => {
            if (event.target.tagName === 'IMG') {
                const selectedNewTextureKey = event.target.getAttribute('data-texture');
                const newTexture = newTextures[selectedNewTextureKey];
                if (selectedPart && newTexture) {
                    selectedPart.material.map = newTexture;
                    selectedPart.material.needsUpdate = true;
                }
                replaceButton.style.display = 'none';
                textureOptions.style.display = 'none';
            }
        });

        // Helper function to find the part with the selected texture
        const getPartWithTexture = (object, textureName) => {
            let part = null;
            object.traverse(child => {
                if (child.isMesh && child.material && child.material.map) {
                    const textureSrc = child.material.map.image.src.toLowerCase();
                    if (textureSrc.includes(textureName.toLowerCase())) {
                        part = child;
                    }
                }
            });
            return part;
        };

        // AR session and hit-test for model placement
        renderer.xr.addEventListener("sessionstart", async () => {
            const session = renderer.xr.getSession();
            const viewerReferenceSpace = await session.requestReferenceSpace("viewer");
            const hitTestSource = await session.requestHitTestSource({ space: viewerReferenceSpace });

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

                renderer.render(scene, camera);
            });
        });
    };

    initialize();
});
