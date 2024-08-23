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

        const model = await loadGLTF('../assets/models/chair/scene.gltf');
        normalizeModel(model.scene, 0.5);
        const chair = new THREE.Group();
        chair.add(model.scene);
        chair.visible = false;
        scene.add(chair);

        let selectedPart = null;
        let selectedTextureImage = null;

        const textures = {
            wood: new THREE.TextureLoader().load('../assets/textures/wood.jpg'),
            leather: new THREE.TextureLoader().load('../assets/textures/leather.jpg'),
            fabric: new THREE.TextureLoader().load('../assets/textures/fabric.jpg')
        };

        const textureImages = document.querySelectorAll('.texture-image');
        const replaceButton = document.getElementById('replace-button');
        const textureOptions = document.getElementById('texture-options');

        textureImages.forEach(img => {
            img.addEventListener('click', () => {
                selectedTextureImage = img;
                const textureName = img.getAttribute('data-texture');
                selectedPart = getPartWithTexture(model.scene, textureName);
                replaceButton.style.display = 'block';
            });
        });

        replaceButton.addEventListener('click', () => {
            textureOptions.style.display = 'block';
        });

        textureOptions.addEventListener('click', event => {
            if (event.target.tagName === 'IMG') {
                const newTexture = textures[event.target.getAttribute('data-texture')];
                if (selectedPart) {
                    selectedPart.material.map = newTexture;
                    selectedPart.material.needsUpdate = true;
                }
                replaceButton.style.display = 'none';
                textureOptions.style.display = 'none';
            }
        });

        const getPartWithTexture = (object, textureName) => {
            let part = null;
            object.traverse(child => {
                if (child.isMesh && child.material.map && child.material.map.image.src.includes(textureName)) {
                    part = child;
                }
            });
            return part;
        };

        renderer.xr.addEventListener("sessionstart", async () => {
            const session = renderer.xr.getSession();
            const viewerReferenceSpace = await session.requestReferenceSpace("viewer");
            const hitTestSource = await session.requestHitTestSource({ space: viewerReferenceSpace });

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

                renderer.render(scene, camera);
            });
        });
    };

    initialize();
});
