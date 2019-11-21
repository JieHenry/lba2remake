import * as React from 'react';
import DebugData, { saveMetaData } from '../../../DebugData';
import Renderer from '../../../../../renderer';

const indexStyle = {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    color: 'white',
    fontSize: '12px',
    background: 'black',
    opacity: 0.8,
    padding: '0 2px'
};

const name = entity =>
    DebugData.metadata.entities[entity.index] || `entity_${entity.index}`;

const LibraryNode = {
    dynamic: true,
    name,
    numChildren: () => 0,
    allowRenaming: () => true,
    style: {
        height: '50px',
        background: '#1F1F1F',
        margin: '4px 0',
        padding: '0'
    },
    nameStyle: {
        lineHeight: '50px',
        height: '50px',
        display: 'block',
        position: 'absolute',
        left: 50,
        right: 0,
        top: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    selectedStyle: {
        background: 'white',
    },
    iconStyle: (data) => {
        let useThumb = false;
        if (data.index in icons) {
            useThumb = true;
        } else {
            const savedIcon = localStorage.getItem(`icon_model_entity_${data.index}`);
            if (savedIcon) {
                useThumb = true;
            }
        }

        return {
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: useThumb ? '50px' : '20px',
            width: useThumb ? '50px' : '20px',
            padding: useThumb ? 0 : 15,
            margin: 0
        };
    },
    rename: (entity, newName) => {
        DebugData.metadata.entities[entity.index] = newName;
        saveMetaData({
            type: 'models',
            subType: 'entities',
            subIndex: entity.index,
            value: newName
        });
    },
    onClick: (data, _setRoot, component) => {
        const {setEntity} = component.props.rootStateHandler;
        setEntity(data.index);
    },
    onDoubleClick: (data, component) => {
        saveIcon(data, component);
    },
    selected: (data, _ignored, component) => {
        if (!component.props.rootState)
            return false;
        const { entity } = component.props.rootState;
        return entity === data.index;
    },
    icon: (data, _ignored, component) => getIcon(data, component),
    props: data => [
        {
            id: 'index',
            value: data.index,
            render: value => <div style={indexStyle}>{value}</div>
        }
    ]
};

const icons = {};
const iconsCanvas = document.createElement('canvas');
iconsCanvas.width = 50;
iconsCanvas.height = 50;
let iconRenderer = null;

function saveIcon(data, component) {
    if (component && component.props.rootState) {
        const { entity } = component.props.rootState;
        if (entity === data.index
            && DebugData.scope.model
            && DebugData.scope.model.entity === entity
            && DebugData.scope.model.mesh) {
            DebugData.scope.grid.visible = false;
            if (!iconRenderer) {
                iconRenderer = new Renderer({webgl2: true}, iconsCanvas, {
                    preserveDrawingBuffer: true
                }, 'thumbnails');
                iconRenderer.applySceneryProps({
                    opacity: 0,
                    envInfo: { skyColor: [0, 0, 0] }
                });
            }
            iconRenderer.resize(50, 50);
            iconRenderer.render(DebugData.scope.scene);
            const dataUrl = iconsCanvas.toDataURL();
            if (dataUrl && dataUrl !== 'data:,') {
                icons[data.index] = dataUrl;
            }
            localStorage.setItem(`icon_model_entity_${data.index}`, dataUrl);
            DebugData.scope.grid.visible = true;
        }
    }
}

function getIcon(data, component) {
    if (data.index in icons) {
        return icons[data.index];
    }
    const savedIcon = localStorage.getItem(`icon_model_entity_${data.index}`);
    if (savedIcon) {
        if (!icons[data.index]) {
            icons[data.index] = savedIcon;
        }
        return savedIcon;
    }
    saveIcon(data, component);
    return 'editor/icons/entity.svg';
}

const LibrariesNode = {
    dynamic: true,
    name: () => 'Libraries',
    numChildren: () => 0,
    child: () => LibraryNode,
    childData: (_data, _idx) => null,
    up: (_data, _collapsed, _component) => {

    },
    down: (_data, _collapsed, _component) => {

    }
};

export default LibrariesNode;
