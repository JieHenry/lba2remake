import * as THREE from 'three';
import convert from 'color-convert';
import { loadHqr } from '../hqr.ts';

export const LUT_DIM = 32;
const LUT_DIM_M1 = LUT_DIM - 1;
const TEXTURE_WIDTH = 512;
const TEXTURE_HEIGHT = (LUT_DIM * LUT_DIM * LUT_DIM) / TEXTURE_WIDTH;

let lutTexture = null;

export async function loadLUTTexture() {
    if (lutTexture) {
        return lutTexture;
    }
    const buffer = await loadLUTData();
    const image_data = new Uint8Array(buffer);
    const texture = new THREE.DataTexture(
        image_data,
        TEXTURE_WIDTH,
        TEXTURE_HEIGHT * 16,
        THREE.RGBAFormat,
        THREE.UnsignedByteType,
        THREE.UVMapping,
        THREE.ClampToEdgeWrapping,
        THREE.ClampToEdgeWrapping,
        THREE.NearestFilter,
        THREE.NearestFilter
    );
    texture.needsUpdate = true;
    lutTexture = texture;
    return texture;
}

export async function resetLUTTexture() {
    const buffer = await loadLUTData();
    const image_data = new Uint8Array(buffer);
    if (lutTexture) {
        lutTexture.image.data = image_data;
        lutTexture.needsUpdate = true;
    }
}

async function loadLUTData() {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.responseType = 'arraybuffer';
        request.open('GET', 'lut.dat', true);

        request.onload = function onload() {
            if (this.status === 200) {
                resolve(request.response);
            } else {
                reject(new Error(`LUT file download failed: status=${this.status}`));
            }
        };

        request.onerror = function onerror(err) {
            reject(err);
        };

        request.send(null);
    });
}

export async function generateLUTTexture({onProgress, bbs, useLabColors}) {
    const ress = await loadHqr('RESS.HQR');
    const palette = new Uint8Array(ress.getEntry(0));
    const buffer = new ArrayBuffer(LUT_DIM * LUT_DIM * LUT_DIM * 16 * 4);
    const image_data = new Uint8Array(buffer);
    const clamp = v => Math.max(Math.min(v, 15), 0);
    for (let r = 0; r < LUT_DIM; r += 1) {
        onProgress(Math.round((r / LUT_DIM) * 100));
        // eslint-disable-next-line no-await-in-loop
        await delay();
        for (let g = 0; g < LUT_DIM; g += 1) {
            for (let b = 0; b < LUT_DIM; b += 1) {
                const tgtIdx = nearestColor([
                    (r / LUT_DIM_M1) * 255,
                    (g / LUT_DIM_M1) * 255,
                    (b / LUT_DIM_M1) * 255
                ], palette, useLabColors, bbs);
                const x = tgtIdx % 16;
                const y = Math.floor(tgtIdx / 16);
                for (let i = 0; i < 16; i += 1) {
                    const level = i * LUT_DIM * LUT_DIM * LUT_DIM * 4;
                    const idx = (r + (LUT_DIM * (g + (LUT_DIM * b)))) * 4;
                    const pIdx = clamp(x + (i - 12)) + (y * 16);
                    image_data[level + idx] = palette[pIdx * 3];
                    image_data[level + idx + 1] = palette[(pIdx * 3) + 1];
                    image_data[level + idx + 2] = palette[(pIdx * 3) + 2];
                }
            }
        }
    }
    if (lutTexture) {
        lutTexture.image.data = image_data;
        lutTexture.needsUpdate = true;
    }
    return buffer;
}

async function delay() {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

function nearestColor([r, g, b], palette, useLabColors, bbs) {
    const c = useLabColors ? convert.rgb.lab(r, g, b) : [r, g, b];
    let min = Infinity;
    let minIdx = 256;
    for (let i = 0; i < 256; i += 1) {
        const x = i % 16;
        const y = Math.floor(i / 16);
        let keep = false;
        for (let j = 0; j < bbs.length; j += 1) {
            const bb = bbs[j];
            if (x >= bb.xMin && x <= bb.xMax && y >= bb.yMin && y <= bb.yMax) {
                keep = true;
                break;
            }
        }
        if (!keep) {
            continue;
        }
        const pr = palette[i * 3];
        const pg = palette[(i * 3) + 1];
        const pb = palette[(i * 3) + 2];
        const p = useLabColors ? convert.rgb.lab(pr, pg, pb) : [pr, pg, pb];
        const dr = p[0] - c[0];
        const dg = p[1] - c[1];
        const db = p[2] - c[2];
        const dist2 = (dr * dr) + (dg * dg) + (db * db);
        if (dist2 < min) {
            min = dist2;
            minIdx = i;
        }
    }
    return minIdx;
}
