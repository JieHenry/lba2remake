import THREE from 'three';
import StereoEffect from './effects/StereoEffect';
import EffectComposer from './effects/postprocess/EffectComposer';
import SMAAPass from './effects/postprocess/SMAAPass';
import RenderPass from './effects/postprocess/RenderPass';
import setupStats from './stats';
import {
    getIsometricCamera,
    getIsometric3DCamera,
    get3DCamera,
    resize3DCamera,
    resizeIsometricCamera,
    resizeIsometric3DCamera
} from './cameras';
import Cardboard from './utils/Cardboard';
import {map} from 'lodash';

const PixelRatioMode = {
    DEVICE: () => window.devicePixelRatio || 1.0,
    DOUBLE: () => 2.0,
    NORMAL: () => 1.0,
    HALF: () => 0.5,
    QUARTER: () => 0.25
};

const PixelRatio = map(['DEVICE', 'DOUBLE', 'NORMAL', 'HALF', 'QUARTER'], (name, idx) => ({
    getValue: PixelRatioMode[name],
    index: idx,
    name: name
}));

export function createRenderer(useVR) {
    let pixelRatio = PixelRatio[0];
    let antialias = false;
    const displayRenderMode = () => console.log(`Renderer mode: pixelRatio=${pixelRatio.name}(${pixelRatio.getValue()}x), antialiasing(${antialias})`);
    const baseRenderer = setupBaseRenderer(pixelRatio);
    const renderer = useVR ? setupVR(baseRenderer) : baseRenderer;
    const camera3D = get3DCamera();
    const cameraIso = getIsometricCamera();
    const cameraIso3D = getIsometric3DCamera();
    const resizer = setupResizer(renderer, camera3D, cameraIso, cameraIso3D);
    let smaa = setupSMAA(renderer, pixelRatio);
    const stats = setupStats(useVR);

    window.addEventListener('keydown', event => {
        if (event.code == 'KeyH') {
            antialias = !antialias;
            displayRenderMode();
            window.dispatchEvent(new CustomEvent('resize'));
        }
        if (event.code == 'KeyR') {
            pixelRatio = PixelRatio[(pixelRatio.index + 1) % PixelRatio.length];
            baseRenderer.setPixelRatio(pixelRatio.getValue());
            smaa = setupSMAA(renderer, pixelRatio);
            displayRenderMode();
            window.dispatchEvent(new CustomEvent('resize'));
        }
    });

    function render(scene, camera) {
        if (antialias) {
            smaa.render(scene, camera);
        }
        else {
            renderer.render(scene, camera);
        }
    }

    displayRenderMode();

    return {
        domElement: baseRenderer.domElement,
        render: scene => {
            renderer.antialias = antialias;
            if (scene.isIsland) {
                render(scene.threeScene, camera3D);
            } else {
                //render(scene.threeScene, cameraIso);
                //renderer.autoClear = false;
                render(scene.sceneNode, cameraIso3D);
                renderer.autoClear = true;
            }
        },
        dispose: () => {
            resizer.dispose();
            stats.dispose();
        },
        applySceneryProps: props => {
            const sc = props.envInfo.skyColor;
            const color = new THREE.Color(sc[0], sc[1], sc[2]);
            renderer.setClearColor(color.getHex(), 1);
        },
        stats: stats,
        cameras: {
            camera3D: camera3D,
            isoCamera: cameraIso
        }
    };
}

function setupBaseRenderer(pixelRatio) {
    const renderer = new THREE.WebGLRenderer({antialias: false, alpha: false, logarithmicDepthBuffer: true});
    renderer.setClearColor(0x000000);
    renderer.setPixelRatio(pixelRatio.getValue());
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.autoClear = true;

    renderer.context.getExtension('EXT_shader_texture_lod');
    renderer.context.getExtension('OES_standard_derivatives');

    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.left = 0;
    renderer.domElement.style.top = 0;
    renderer.domElement.style.opacity = 1.0;

    return renderer;
}

function setupSMAA(renderer, pixelRatio) {
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass();
    composer.addPass(renderPass);

    const pass = new SMAAPass(window.innerWidth * pixelRatio.getValue(), window.innerHeight * pixelRatio.getValue());
    pass.renderToScreen = true;
    composer.addPass(pass);
    return {
        render(scene, camera) {
            renderPass.scene = scene;
            renderPass.camera = camera;
            composer.render();
        }
    }
}

function setupResizer(renderer, camera3D, cameraIso, cameraIso3D) {
    function resize() {
        renderer.setSize(window.innerWidth, window.innerHeight);
        resize3DCamera(camera3D);
        resizeIsometricCamera(cameraIso);
        resizeIsometric3DCamera(cameraIso3D);
    }

    window.addEventListener('resize', resize);
    return {dispose: () => { window.removeEventListener('resize', resize) }};
}

function setupVR(baseRenderer) {
    const params = Cardboard.uriToParams('https://vr.google.com/cardboard/download/?p=CgdUd2luc3VuEgRBZHJpHfT91DwlYOVQPSoQAAC0QgAAtEIAALRCAAC0QlgANQIrBz06CClcjz0K1yM8UABgAA');
    console.log(params);
    const stereoEffect = new StereoEffect(baseRenderer, params);
    stereoEffect.eyeSeparation = 0.006;
    stereoEffect.focalLength = 0.0122;
    stereoEffect.setSize(window.innerWidth, window.innerHeight);
    return stereoEffect;
}
