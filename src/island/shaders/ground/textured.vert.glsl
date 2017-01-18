precision highp float;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

attribute vec3 position;
attribute vec2 colorInfo;
attribute vec2 uv;

varying vec2 vColorInfo;
varying vec2 vUv;
varying vec3 vPos;

void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vColorInfo = colorInfo;
    vUv = uv;
    vPos = position;
}