import BlocklyAreaContent from './BlocklyAreaContent';

const BlocklyArea = {
    id: 'blockly_editor',
    name: 'Blockly Scripts',
    icon: 'blockly.svg',
    content: BlocklyAreaContent,
    getInitialState: () => ({
        actorIndex: 0,
    }),
    stateHandler: {
        setActor(actorIndex) {
            this.setState({actorIndex});
        }
    }
};

export default BlocklyArea;
