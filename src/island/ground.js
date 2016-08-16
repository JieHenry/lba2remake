const push = Array.prototype.push;

export function loadGround(island, section, geometries, usedTiles) {
    for (let x = 0; x < 64; ++x) {
        for (let y = 0; y < 64; ++y) {
            const t0 = loadTriangle(section, x, y, 0);
            const t1 = loadTriangle(section, x, y, 1);

            const r = t0.orientation;
            const s = 1 - r;

            const point = (xi, yi) => (x + xi) * 65 + y + yi;

            const isSeaLevelLiquid = (t, p) => {
                const seaLevel = section.heightmap[p[0]] == 0 && section.heightmap[p[1]] == 0 && section.heightmap[p[2]] == 0;
                return seaLevel && t.liquid != 0;
            };

            const triangle = (t, p) => {
                if (!isSeaLevelLiquid(t, p) && (t.useColor || t.useTexture)) {
                    usedTiles[x * 64 + y] = t0.orientation;
                    if (t.useTexture) {
                        push.apply(geometries.textured.positions, getPositions(section, p));
                        push.apply(geometries.textured.uvs, getUVs(section.textureInfo, t.textureIndex));
                        push.apply(geometries.textured.colorInfos, getColorInfos(section.intensity, t, p));
                    } else {
                        push.apply(geometries.colored.positions, getPositions(section, p));
                        push.apply(geometries.colored.colorInfos, getColorInfos(section.intensity, t, p));
                    }
                }
            };

            triangle(t0, [point(0, r), point(s, 0), point(1, s)]);
            triangle(t1, [point(1, s), point(r, 1), point(0, r)]);
        }
    }
}

function loadTriangle(section, x, y, idx) {
    const flags = section.triangles[(x * 64 + y) * 2 + idx];
    const bits = (bitfield, offset, length) => (bitfield & (((1 << length) - 1)) << offset) >> offset;
    return {
        textureBank: bits(flags, 0, 4),
        useTexture: bits(flags, 4, 2),
        useColor: bits(flags, 6, 2),
        orientation: bits(flags, 16, 1),
        textureIndex: bits(flags, 19, 13),
        liquid: bits(flags, 12, 4)
    };
}

function getPositions(section, points) {
    const positions = [];
    for (let i = 0; i < 3; ++i) {
        const idx = points[i];
        const x = section.x * 64 + (65 - Math.floor(idx / 65));
        const y = section.heightmap[idx];
        const z = section.z * 64 + (idx % 65);
        positions.push(x / 32, y / 0x4000, z / 32);
    }
    return positions;
}

function getUVs(textureInfo, index) {
    const offset = index * 12;
    return [
        textureInfo[offset + 1], textureInfo[offset + 3],
        textureInfo[offset + 5], textureInfo[offset + 7],
        textureInfo[offset + 9], textureInfo[offset + 11]
    ];
}

function getColorInfos(intensity, triangle, points) {
    const colorsInfo = [];
    for (let i = 0; i < 3; ++i) {
        push.apply(colorsInfo, getColorInfo(triangle, intensity[points[i]]));
    }
    return colorsInfo;
}

function getColorInfo(triangle, intensity) {
    if (triangle.useColor) {
        const idx = triangle.textureBank;
        return [intensity, idx];
    } else {
        return [intensity, 0];
    }
}
