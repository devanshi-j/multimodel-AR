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

        const arButton = ARButton.createButton(renderer, { 
            requiredFeatures: ['hit-test'], 
            optionalFeatures: ['dom-overlay'], 
            domOverlay: { root: document.body } 
        });
        document.body.appendChild(renderer.domElement);
        document.body.appendChild(arButton);

        const model = await loadGLTF('../assets/models/coffee-table/scene.gltf');
        normalizeModel(model.scene, 0.5);
        const coffeeTable = new THREE.Group();
        coffeeTable.add(model.scene);
        coffeeTable.visible = false;
        scene.add(coffeeTable);

        // Keep track of selected part and texture image
        let selectedPart = null;
        let selectedTextureImage = null;

        // Old Textures loaded initially with unique keys
        const oldTextures = {
            steelNormal: new THREE.TextureLoader().load('../assets/models/coffee-table/textures/Old_Steel_normal.png'),
            steelGloss: new THREE.TextureLoader().load('../assets/models/coffee-table/textures/Old_Steel_specularGlossiness.png'),
            woodDiffuse: new THREE.TextureLoader().load('../assets/models/coffee-table/textures/Table_wood_1_diffuse.jpeg'),
            woodNormal: new THREE.TextureLoader().load('../assets/models/coffee-table/textures/Table_wood_1_normal.jpeg')
        };

        // New Textures to be loaded when replacing with unique keys
        const newTextures = {
            woodTx1: new THREE.TextureLoader().load('../assets/textures/tx1.jpg'),
            woodTx2: new THREE.TextureLoader().load('../assets/textures/tx2.jpg'),
            woodTx3: new THREE.TextureLoader().load('../assets/textures/tx3.jpg')
        };

        // Apply old textures to model initially using selective traversal
        model.scene.traverse(child => {
            if (child.isMesh && child.material && child.material.map) {
                // Preserve original textures based on their source
                const textureSrc = child.material.map.image.src.toLowerCase(); // Convert to lowercase for case-insensitive comparison

                if (textureSrc.includes('table_wood_1_diffuse')) {
                    child.material.map = oldTextures.woodDiffuse;
                } else if (textureSrc.includes('table_wood_1_normal')) {
                    child.material.map = oldTextures.woodNormal;
                } else if (textureSrc.includes('old_steel_normal')) {
                    child.material.map = oldTextures.steelNormal;
                } else if (textureSrc.includes('old_steel_specularglossiness')) {
                    child.material.map = oldTextures.steelGloss;
                }
                // Add more conditions for other textures as needed
            }
        });

        // Selectors for texture images and buttons
        const textureImages = document.querySelectorAll('.texture-image');
        const replaceButton = document.getElementById('replace-button');
        const textureOptions = document.getElementById('texture-options');

        // Event listener for selecting a texture image
        textureImages.forEach(img => {
            img.addEventListener('click', () => {
                selectedTextureImage = img;
                const textureName = img.getAttribute('data-texture');
                selectedPart = getPartWithTexture(model.scene, textureName);
                replaceButton.style.display = 'block';
            });
        });

        // Event listener for the replace button
        replaceButton.addEventListener('click', () => {
            textureOptions.style.display = 'block';
        });

        // Event listener for applying the new texture
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
