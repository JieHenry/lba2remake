import {LifeOpcode} from './data/life';
import {MoveOpcode} from './data/move';
import {ConditionOpcode} from './data/condition';

const scripts_cache = {};
let selectedActor = -1;

export function initDebugForScene(scene) {
    window.dispatchEvent(new CustomEvent('lba_ext_event_out', {
        detail: {
            type: 'setScene',
            index: scene.index, actors: scene.actors.length + 1
        }
    }));
    window.addEventListener('lba_ext_event_in', function(event) {
        const message = event.detail;
        if (message.type == 'selectActor') {
            selectedActor = message.index;
            const actor = message.index == 0 ? {index: 0, props: scene.data.hero} : scene.data.actors[message.index - 1];
            const scripts = getScripts(scene, actor);
            window.dispatchEvent(new CustomEvent('lba_ext_event_out', {
                detail: {
                    type: 'setActorScripts',
                    life: {
                        commands: scripts.life.commands,
                        activeLine: scripts.life.activeLine
                    },
                    move: {
                        commands: scripts.move.commands,
                        activeLine: scripts.move.activeLine
                    }
                }
            }));
        }
    });
}

export function setCursorPosition(scene, actor, scriptType, offset) {
    const scripts = getScripts(scene, actor);
    const line = scripts[scriptType].opMap[offset];
    if (line === undefined)
        return;
    /*
    if (scripts[scriptType].activeLine != line)
        console.log(selectedActor, scriptType, line);
    */
    if (scripts[scriptType].activeLine != line && selectedActor == actor.index) {
        window.dispatchEvent(new CustomEvent('lba_ext_event_out', {
            detail: {
                type: 'setCurrentLine',
                scene: scene.index,
                actor: actor.index,
                scriptType: scriptType,
                line: line
            }
        }));
    }
    scripts[scriptType].activeLine = line;
}

function getScripts(scene, actor) {
    const key = scene.index + '_' + actor.index;
    if (key in scripts_cache) {
        return scripts_cache[key];
    } else {
        const scripts = {
            life: decompileScript('life', actor.props.lifeScript, LifeOpcode),
            move: decompileScript('move', actor.props.moveScript, MoveOpcode)
        };
        scripts_cache[key] = scripts;
        return scripts;
    }
}

function decompileScript(type, script, Opcodes) {
    let offset = 0;
    const commands = [];
    const opMap = {};
    while (offset < script.byteLength) {
        const opcode = script.getUint8(offset);
        opMap[offset] = commands.length;
        const op = Opcodes[opcode];
        if (!op) {
            commands.push({name: '&lt;ERROR PARSING SCRIPT&gt;'});
            break;
        }
        commands.push({
            name: op.command,
            condition: getCondition(script, offset, op),
            args: getArgs(script, offset, op),
            indent: getIndent(type, op)
        });
        offset = getNewOffset(script, offset, op);
    }
    return {
        activeLine: -1,
        opMap: opMap,
        commands: commands
    };
}

function getCondition(script, offset, op) {
    switch (op.command) {
        case 'IF':
        case 'SWIF':
        case 'SNIF':
        case 'ONEIF':
        case 'NEVERIF':
        case 'ORIF':
        case 'AND_IF':
        case 'SWITCH':
            const cond_code = script.getUint8(offset + 1);
            const cond = ConditionOpcode[cond_code];
            if (cond) {
                return {
                    name: cond.command
                };
            }
    }
}

const TypeSize = {
    'Int8': 1,
    'Uint8': 1,
    'Int16': 2,
    'Uint16': 2,
    'Int32': 4,
    'Uint32': 4,
};

function getArgs(script, offset, op) {
    if (op.args) {
        let o = 1;
        const args = [];
        for (let i = 0; i < op.args.length; ++i) {
            args.push(script['get' + op.args[i]](offset + o));
            o += TypeSize[op.args[i]];
        }
        return args;
    }
}

function getIndent(type, op) {
    if (type == 'move' && op.command != 'LABEL' && op.command != 'END') {
        if (op.command == 'LABEL' || op.command == 'REPLACE' || op.command == 'END')
            return 0;
        else
            return 1;
    } else {
        return 0;
    }
}

function getNewOffset(script, offset, op) {
    let extraOffset = 0;
    switch (op.command) {
        case 'IF':
        case 'SWIF':
        case 'SNIF':
        case 'ONEIF':
        case 'NEVERIF':
        case 'ORIF':
        case 'AND_IF':
        case 'SWITCH':
            const cond_code = script.getUint8(offset + 1);
            const cond = ConditionOpcode[cond_code];
            if (cond)
                extraOffset = cond.param + cond.value_size + 4;
            break;
    }
    return offset + extraOffset + op.offset + 1;
}