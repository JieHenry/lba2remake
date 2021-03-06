import * as THREE from 'three';

import { Entity } from './entity';
import {
    initSkeleton,
    createSkeleton,
} from './animState';
import { loadMesh } from './geometries';
import { createBoundingBox } from '../utils/rendering';
import { loadLUTTexture } from '../utils/lut';
import {
    getCommonResource,
    getPalette,
    getEntities,
    getModels,
    getAnimations,
    getModelsTexture
} from '../resources';
import { getParams } from '../params';

export interface Model {
    state: any;
    anims: any;
    files?: any;
    entities: Entity[];
    mesh: THREE.Object3D;
    boundingBox?: THREE.Box3;
    boundingBoxDebugMesh?: THREE.Object3D;
}

export async function loadModel(
    entityIdx: number,
    bodyIdx: number,
    animIdx: number,
    animState: any,
    envInfo: any,
    ambience: any
) {
    const [ress, pal, entities, body, texture, anim, lutTexture] = await Promise.all([
        getCommonResource(),
        getPalette(),
        getEntities(),
        getModels(bodyIdx, entityIdx),
        getModelsTexture(),
        getAnimations(animIdx, entityIdx),
        loadLUTTexture()
    ]);
    const resources = { ress, pal, entities, body, texture, anim };
    return loadModelData(
        resources,
        entityIdx,
        bodyIdx,
        animIdx,
        animState,
        envInfo,
        ambience,
        lutTexture
    );
}

/** Load Models Data
 *  Model will hold data specific to a single model instance.
 *  This will allow to mantain different states for body animations.
 *  This module will still kept data reloaded to avoid reload twice for now.
 */
function loadModelData(
    resources,
    entityIdx,
    bodyIdx,
    animIdx,
    animState: any,
    envInfo: any,
    ambience: any,
    lutTexture: THREE.Texture
) {
    if (entityIdx === -1 || bodyIdx === -1 || animIdx === -1)
        return null;

    const palette = resources.pal;
    const entities = resources.entities;
    const texture = resources.texture;
    const body = resources.body;
    const anim = resources.anim;

    const model = {
        palette,
        lutTexture,
        files: resources,
        bodies: [],
        anims: [],
        texture,
        state: null,
        mesh: null,
        entities,
        boundingBox: null,
        boundingBoxDebugMesh: null,
        entity: entities[entityIdx],
        materials: []
    };

    const skeleton = createSkeleton(body);
    initSkeleton(animState, skeleton, anim.loopFrame);
    const { object, materials } = loadMesh(
        body,
        model.texture,
        animState.bones,
        animState.matrixRotation,
        model.palette,
        model.lutTexture,
        envInfo,
        ambience
    );
    model.mesh = object;
    model.materials = materials;

    if (model.mesh) {
        model.boundingBox = body.boundingBox;
        if (getParams().editor) {
            model.boundingBoxDebugMesh = createBoundingBox(
                body.boundingBox,
                new THREE.Vector3(1, 0, 0)
            );
            model.boundingBoxDebugMesh.name = 'BoundingBox';
            model.boundingBoxDebugMesh.visible = false;
            model.mesh.add(model.boundingBoxDebugMesh);
        }
    }

    return model;
}
