import { each } from 'lodash';
import { loadSceneData } from '../scene';
import { loadSceneMetaData, getObjectName } from '../ui/editor/DebugData';
import { getLanguageConfig } from '../lang';
import { parseScript } from '../scripting/parser';

export async function forEachScene(callback) {
    const {language} = getLanguageConfig();
    for (let idx = 0; idx < 222; idx += 1) {
        const [scene] = await Promise.all([
            loadSceneData(language, idx),
            loadSceneMetaData(idx)
        ]);
        callback(scene);
    }
}

interface ScriptCallback {
    (script: any, actor: any, scene: any, type: string): void;
}

export async function forEachScript(callback: ScriptCallback, type = null) {
    forEachScene((scene) => {
        each(scene.actors, (actor, idx) => {
            if (!type || type === 'life') {
                const script = parseScript(idx, 'life', actor.lifeScript);
                callback(script, actor, scene, type);
            }
            if (!type || type === 'move') {
                const script = parseScript(idx, 'move', actor.moveScript);
                callback(script, actor, scene, type);
            }
        });
    });
}

function displayResults(scene, actor, results) {
    if (results.length > 0) {
        const actorName = getObjectName('actor', scene.index, actor.index);
        // tslint:disable-next-line: no-console
        console.log(`SCENE ${scene.index}, actor=${actorName}`);
        each(results, (r) => {
            // tslint:disable-next-line: no-console
            console.log(r);
        });
    }
}

export function findCondition(name) {
    forEachScript((script, actor, scene) => {
        const results = [];
        each(script.commands, (cmd, idx) => {
            if (cmd.condition && cmd.condition.op.command === name) {
                results.push(`  found cond ${name} at ${idx}`);
            }
        });
        displayResults(scene, actor, results);
    }, 'life');
}

export function findAndOrSeq() {
    forEachScript((script, actor, scene) => {
        let count = 0;
        let start = null;
        const results = [];
        each(script.commands, (cmd, idx) => {
            const name = cmd.op.command;
            if (name === 'OR_IF' || name === 'AND_IF') {
                if (count === 0) {
                    start = idx;
                }
                count += 1;
            } else {
                if (count > 3) {
                    results.push(`  found ${count} conds at ${start}`);
                }
                count = 0;
            }
        });
        displayResults(scene, actor, results);
    }, 'life');
}

export function findAndOrMixedSeq() {
    forEachScript((script, actor, scene) => {
        let pushed = false;
        let prev = null;
        const results = [];
        each(script.commands, (cmd, idx) => {
            const name = cmd.op.command;
            if (name === 'OR_IF' || name === 'AND_IF') {
                if (prev !== null && name !== prev && !pushed) {
                    results.push(`  found mixed seq at ${idx}`);
                    pushed = true;
                }
                prev = name;
            } else {
                prev = null;
                pushed = false;
            }
        });
        displayResults(scene, actor, results);
    }, 'life');
}
