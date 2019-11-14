import THREE from 'three';
import { map, each, assign, tail} from 'lodash';

import { loadHqr } from '../hqr';
import { prepareGeometries } from './geometries';
import { loadLayout } from './layout';
import { loadGround } from './ground';
import { loadSea } from './sea';
import { loadObjects } from './objects';
import { loadModel } from './model';
import { loadIslandPhysics } from '../game/loop/physicsIsland';
import { createBoundingBox } from '../utils/rendering';
import { loadLUTTexture } from '../utils/lut';
import islandsInfo from './data/islands';
import environments from './data/environments';
import { createTextureAtlas } from './atlas';

const islandProps = {};
each(islandsInfo, (island) => {
    islandProps[island.name] = assign({
        envInfo: environments[island.env]
    }, island);
});

const islands = {};
const islandPreviews = {};

interface IslandGeometry {
    positions?: number[];
    uvs?: number[];
    uvGroups?: number[];
    colors?: number[];
    normals?: number[];
    intensities?: number[];
    material: THREE.Material;
}

export function getEnvInfo(name) {
    return islandProps[name].envInfo;
}

export async function loadIslandScenery(params, name, ambience) {
    if (params.preview) {
        if (name in islandPreviews) {
            return islandPreviews[name];
        }
    } else if (name in islands) {
        return islands[name];
    }

    const [ress, ile, obl, lutTexture] = await Promise.all([
        loadHqr('RESS.HQR'),
        loadHqr(`${name}.ILE`),
        loadHqr(`${name}.OBL`),
        loadLUTTexture()
    ]);
    const files = {ress, ile, obl};
    const island = loadIslandNode(params, islandProps[name], files, lutTexture, ambience);
    if (params.preview) {
        islandPreviews[name] = island;
    } else {
        islands[name] = island;
    }
    return island;
}

function loadIslandNode(params, props, files, lutTexture, ambience) {
    const islandObject = new THREE.Object3D();
    islandObject.name = `scenery_${props.name}`;
    islandObject.matrixAutoUpdate = false;
    const layout = loadLayout(files.ile);
    const data = {
        files,
        palette: new Uint8Array(files.ress.getEntry(0)),
        layout,
        lutTexture
    };

    const geometries = loadGeometries(props, data, ambience);
    const matByName = {};
    each(geometries, (geom: IslandGeometry, name) => {
        const {positions, uvs, colors, intensities, normals, uvGroups, material} = geom;
        if (positions && positions.length > 0) {
            const bufferGeometry = new THREE.BufferGeometry();
            bufferGeometry.setAttribute(
                'position',
                new THREE.BufferAttribute(new Float32Array(positions), 3)
            );
            if (uvs) {
                bufferGeometry.setAttribute(
                    'uv',
                    new THREE.BufferAttribute(new Uint8Array(uvs), 2, false)
                );
            }
            if (colors) {
                bufferGeometry.setAttribute(
                    'color',
                    new THREE.BufferAttribute(new Uint8Array(colors), 1, false)
                );
            }
            if (intensities) {
                bufferGeometry.setAttribute(
                    'intensity',
                    new THREE.BufferAttribute(new Uint8Array(intensities), 1, false)
                );
            }
            if (normals) {
                bufferGeometry.setAttribute(
                    'normal',
                    new THREE.BufferAttribute(new Float32Array(normals), 3)
                );
            }
            if (uvGroups) {
                bufferGeometry.setAttribute(
                    'uvGroup',
                    new THREE.BufferAttribute(new Uint16Array(uvGroups), 4, false)
                );
            }
            const mesh = new THREE.Mesh(bufferGeometry, material);
            mesh.matrixAutoUpdate = false;
            mesh.name = name;
            matByName[name] = material;
            islandObject.add(mesh);
        }
    });

    if (!params.preview) {
        islandObject.add(loadSky(geometries, props.envInfo));
    }

    const sections = {};
    let boundingBoxes = null;
    if (params.editor) {
        boundingBoxes = new THREE.Object3D();
        boundingBoxes.name = 'BoundingBoxes';
        boundingBoxes.visible = false;
        boundingBoxes.matrixAutoUpdate = false;
        islandObject.add(boundingBoxes);
    }
    if (params.preview) {
        loadSectionPlanes(islandObject, data);
    }
    each(data.layout.groundSections, (section) => {
        sections[`${section.x},${section.z}`] = section;
        if (params.editor) {
            each(section.boundingBoxes, (bb, idx) => {
                const box = createBoundingBox(bb, new THREE.Vector3(0.9, 0.9, 0.9));
                box.name = `[${section.x},${section.z}]:${idx}`;
                boundingBoxes.add(box);
            });
        }
    });

    const seaMesh = islandObject.getObjectByName('sea') as THREE.Mesh;
    const seaTimeUniform = (seaMesh.material as THREE.RawShaderMaterial).uniforms.time;

    return {
        props,
        sections: map(layout.groundSections,
            section => ({x: section.x, z: section.z, boundingBoxes: section.boundingBoxes })),
        threeObject: islandObject,
        physics: loadIslandPhysics(sections),

        updateSeaTime: (time) => {
            seaTimeUniform.value = time.elapsed;
        },
        /* @inspector(locate) */
        update: (game, scene, time) => {
            if (scene) {
                updateShadows(scene, matByName);
            }
            seaTimeUniform.value = time.elapsed;
        }
    };
}

function loadSectionPlanes(islandObject, data) {
    const sectionsPlanes = new THREE.Object3D();
    const sectionsPlanesGeom = new THREE.PlaneBufferGeometry(64 * 0.75, 64 * 0.75);
    const sectionsPlanesMat = new THREE.MeshBasicMaterial({color: 0xff0000});
    sectionsPlanes.name = 'sectionsPlanes';
    sectionsPlanes.visible = false;
    sectionsPlanes.renderOrder = 3;
    islandObject.add(sectionsPlanes);
    each(data.layout.groundSections, (section) => {
        const plane = new THREE.Mesh(sectionsPlanesGeom, sectionsPlanesMat);
        plane.position.set(((section.x * 64) + 33) * 0.75, 0, ((section.z * 64) + 32) * 0.75);
        plane.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
        plane.userData = {
            x: section.x,
            y: section.y,
            info: section
        };
        sectionsPlanes.add(plane);
    });
}

function loadSky(geometries, envInfo) {
    const bufferGeometry = new THREE.BufferGeometry();
    const height = envInfo.skyHeight || 48;
    const positions = [
        -1536, height, -1536,
        1536, height, -1536,
        1536, height, 1536,
        -1536, height, -1536,
        1536, height, 1536,
        -1536, height, 1536
    ];
    const uvs = [
        0, 0,
        1, 0,
        1, 1,
        0, 0,
        1, 1,
        0, 1
    ];
    bufferGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(positions), 3)
    );
    bufferGeometry.setAttribute(
        'uv',
        new THREE.BufferAttribute(new Uint8Array(uvs), 2, false)
    );
    const sky = new THREE.Mesh(
        bufferGeometry,
        geometries.sky.material
    );
    sky.name = 'sky';
    return sky;
}

function loadGeometries(island, data, ambience) {
    const usedTiles = {};

    const models = [];
    const uvGroupsS : Set<string> = new Set();
    const obl = data.files.obl;
    for (let i = 0; i < obl.length; i += 1) {
        const model = loadModel(obl.getEntry(i));
        models.push(model);
        each(model.uvGroups, (group) => {
            uvGroupsS.add(group.join(','));
        });
    }
    const uvGroups = [...uvGroupsS]
        .map(g => g.split(',').map(v => Number(v)))
        .sort((g1, g2) => (g2[2] * g2[3]) - (g1[2] * g1[3]));
    const atlas = createTextureAtlas(data, uvGroups);

    const geometries = prepareGeometries(island, {...data, atlas}, ambience);

    each(data.layout.groundSections, (section) => {
        const tilesKey = [section.x, section.z].join(',');
        usedTiles[tilesKey] = [];
        loadGround(section, geometries, usedTiles[tilesKey]);
        loadObjects(section, geometries, models, atlas);
    });

    each(data.layout.seaSections, (section) => {
        const xd = Math.floor(section.x / 2);
        const zd = Math.floor(section.z / 2);
        const offsetX = 1 - Math.abs(section.x % 2);
        const offsetZ = Math.abs(section.z % 2);
        const tilesKey = [xd, zd].join(',');
        loadSea(section, geometries, usedTiles[tilesKey], offsetX, offsetZ, island.envInfo.index);
    });

    return geometries;
}

const DIFF = new THREE.Vector3();
const POSITION = new THREE.Vector3();
const HERO_POS = new THREE.Vector3();

const SHADOW_MAX_DIST = 15;
const SHADOW_MAX_DIST_SQ = SHADOW_MAX_DIST * SHADOW_MAX_DIST;

function updateShadows(baseScene, matByName) {
    const shadows = [];

    function computeShadow(scene, actor) {
        if (!actor.props.flags.isSprite
            && !actor.props.flags.noShadow
            && actor.model
            && actor.isVisible
            && actor.threeObject.visible) {
            const sz = actor.model.boundingBox.max.x - actor.model.boundingBox.min.x;
            POSITION.copy(actor.physics.position);
            POSITION.applyMatrix4(scene.sceneNode.matrixWorld);
            const distToHero = HERO_POS ? DIFF.subVectors(POSITION, HERO_POS).lengthSq() : 0;
            if (distToHero < SHADOW_MAX_DIST_SQ) {
                shadows.push({
                    data: [POSITION.x, POSITION.z, 2.8 / sz, 1],
                    distToHero
                });
            }
        }
    }

    computeShadow(baseScene, baseScene.actors[0]);
    HERO_POS.copy(POSITION);
    each(tail(baseScene.actors), computeShadow.bind(null, baseScene));
    each(baseScene.sideScenes, (sideScene) => {
        each(sideScene.actors, computeShadow.bind(null, sideScene));
    });
    shadows.sort((a, b) => a.distToHero - b.distToHero);
    for (let i = 0; i < 10; i += 1) {
        const shadow = shadows[i];
        const {ground_colored, ground_textured} = matByName;
        if (shadow) {
            if (ground_colored)
                ground_colored.uniforms.actorPos.value[i].fromArray(shadow.data);
            if (ground_textured)
                ground_textured.uniforms.actorPos.value[i].fromArray(shadow.data);
        } else {
            if (ground_colored)
                (ground_colored.uniforms.actorPos.value[i].w = 0);
            if (ground_textured)
                (ground_textured.uniforms.actorPos.value[i].w = 0);
        }
    }
}