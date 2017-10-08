import React from 'react';
import {extend, each, map} from 'lodash';
import ToolShelf, {style as tsStyle} from '../ToolShelf';
import {loadDefaultProfile, saveDefaultProfile} from './DebugHUD/profiles';
import {execute} from './DebugHUD/exprDSL/execute';
import {addSlot} from './DebugHUD/slots';
import Expression from './DebugHUD/Expression';

const Status = {
    NORMAL: 0,
    LOAD: 1,
    SAVE: 2
};

const exprInputStyle = extend({
    width: '80%'
}, tsStyle.input);

const sectionStyle = {
    paddingBottom: 10
};

export default class DebugHUD extends ToolShelf {
    constructor(props) {
        super(props);

        this.newProfile = this.newProfile.bind(this);
        this.loadProfile = this.loadProfile.bind(this);
        this.saveProfile = this.saveProfile.bind(this);
        this.cancel = this.cancel.bind(this);
        this.addExpression = this.addExpression.bind(this);
        this.inputKeyDown = this.inputKeyDown.bind(this);

        this.state = {
            status: Status.NORMAL,
            slots: loadDefaultProfile()
        };
    }

    renderTitle() {
        if (this.state.status === Status.NORMAL) {
            return 'DebugHUD';
        }
    }

    renderMenu() {
        switch (this.state.status) {
            case Status.NORMAL:
                return [
                    <button key="new" style={tsStyle.button} onClick={this.newProfile}>New</button>,
                    <button key="load" style={tsStyle.button} onClick={this.loadProfile}>Load</button>,
                    <button key="save" style={tsStyle.button} onClick={this.saveProfile}>Save</button>
                ];
            case Status.LOAD:
                return [
                    <button key="load" style={tsStyle.button} onClick={this.cancel}>Cancel</button>
                ];
            case Status.SAVE:
                return [
                    <input key="input" style={tsStyle.input} spellCheck={false}/>,
                    <button key="cancel" style={tsStyle.button} onClick={this.cancel}>Cancel</button>,
                    <button key="save" style={tsStyle.button}>Save</button>
                ];
        }
    }

    renderContent() {
        switch (this.state.status) {
            case Status.NORMAL:
                return this.renderNormal();
            case Status.LOAD:
                return null;
            case Status.SAVE:
                return null;
        }
    }

    renderNormal() {
        const macros = map(this.state.slots.macros, (macro, key) => {
            return <div key={key} style={{background: 'darkslategrey'}}>
                <button style={tsStyle.button} onClick={this.removeMacro.bind(this, key)}>-</button>
                <span> {macro.expr}</span>
            </div>;
        });
        const expressions = map(this.state.slots.expressions, (expr, idx) => {
            return <div key={expr.expr}>
                <button style={tsStyle.button} onClick={this.removeExpression.bind(this, idx)}>-</button>
                <Expression expr={expr}/>
            </div>;
        });
        return <div>
            {macros.length > 0
                ? <div style={sectionStyle}>{macros}</div>
                : null}
            {expressions.length > 0
                ? <div style={sectionStyle}>{expressions}</div>
                : null}
            {this.renderFooter()}
        </div>;
    }

    renderFooter() {
        return <div style={{textAlign: 'right'}}>
            <input ref={ref => this.input = ref}
                   style={exprInputStyle}
                   list="dbgHUD_completion"
                   spellCheck={false}
                   onKeyDown={this.inputKeyDown}
                   onKeyUp={e => e.stopPropagation()}
            />
            <datalist ref={ref => this.completion = ref} id="dbgHUD_completion">
            </datalist>
            <button style={tsStyle.button} onClick={this.addExpression}>+</button>
        </div>;
    }

    frame() {
        const slots = this.state.slots;
        const {macros, expressions} = slots;
        each(expressions, expr => {
            try {
                expr.value = execute(expr.program, [this.props.data], macros);
                delete expr.error;
            }
            catch (e) {
                expr.error = e;
                delete expr.value;
            }
        });
        this.setState({slots});
    }

    inputKeyDown(event) {
        const key = event.code || event.which || event.keyCode;
        if (key === 'Enter' || key === 13) {
            this.addExpression();
        } else if (key === 'Tab' || key === 9) {
            if (this.completion.children.length > 0) {
                this.input.value = this.completion.children[0].value;
            }
            event.preventDefault();
        }
        event.stopPropagation();
    }

    addExpression() {
        const slots = this.state.slots;
        if (this.input.value && addSlot(slots, this.input.value)) {
            this.input.value = '';
            this.setState({slots});
            saveDefaultProfile(slots);
        }
    }

    removeMacro(macro) {
        const slots = this.state.slots;
        delete slots.macros[macro];
        this.setState({slots});
        saveDefaultProfile(slots);
    }

    removeExpression(index) {
        const slots = this.state.slots;
        delete slots.expressions.splice(index, 1);
        this.setState({slots});
        saveDefaultProfile(slots);
    }

    newProfile() {

    }

    loadProfile() {
        this.setState({status: Status.LOAD});
    }

    saveProfile() {
        this.setState({status: Status.SAVE});
    }

    cancel() {
        this.setState({status: Status.NORMAL});
    }
}