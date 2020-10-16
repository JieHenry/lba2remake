import * as React from 'react';
import * as THREE from 'three';

import Renderer from '../renderer';
import {createGame} from '../game/index';
import {mainGameLoop} from '../game/loop';
import {SceneManager} from '../game/scenes';

import {fullscreen} from './styles/index';

import FrameListener from './utils/FrameListener';
import Loader from './game/Loader';
import {sBind} from '../utils';
import {loadVRScene, updateVRScene} from './vr/vrScene';
import {tr} from '../lang';
import { TickerProps } from './utils/Ticker';
import { pure } from '../utils/decorators';
import { VRControls } from '../controls/vr';

interface VRGameUIProps extends TickerProps {
    params: any;
    exitVR: () => any;
}

interface VRGameUIState {
    clock: THREE.Clock;
    game: any;
    scene?: any;
    renderer: Renderer;
    sceneManager: any;
    controls?: any;
    cinema: boolean;
    text?: {
        value: string;
        color: string;
        type: string;
    };
    skip: boolean;
    ask: {choices: []};
    interjections: {};
    foundObject?: any;
    loading: boolean;
    video?: any;
    choice?: number;
    menuTexts?: any;
    showMenu: boolean;
    inGameMenu: boolean;
    teleportMenu: boolean;
    enteredVR: boolean;
    vrScene?: any;
    infoBubble?: string;
}

export default class VRGameUI extends FrameListener<VRGameUIProps, VRGameUIState> {
    canvas: HTMLCanvasElement;
    wrapperElem: HTMLElement;
    preloadPromise: Promise<void>;
    session?: any;

    constructor(props) {
        super(props);

        this.onWrapperRef = this.onWrapperRef.bind(this);
        this.frame = this.frame.bind(this);
        this.onSessionEnd = this.onSessionEnd.bind(this);
        this.requestPresence = this.requestPresence.bind(this);
        this.setUiState = sBind(this.setUiState, this);
        this.getUiState = sBind(this.getUiState, this);
        this.showMenu = this.showMenu.bind(this);
        this.hideMenu = this.hideMenu.bind(this);
        this.exitVR = this.exitVR.bind(this);

        this.session = null;

        const clock = new THREE.Clock(false);
        const game = createGame(
            clock,
            this.setUiState,
            this.getUiState,
            props.params,
            true
        );

        this.canvas = document.createElement('canvas');
        const renderer = new Renderer(this.canvas, 'game', {vr: true});
        const sceneManager = new SceneManager(
            game,
            renderer,
            this.hideMenu.bind(this)
        );

        this.state = {
            clock,
            game,
            renderer,
            sceneManager,
            cinema: false,
            text: null,
            skip: false,
            ask: {choices: []},
            interjections: {},
            foundObject: null,
            loading: true,
            video: null,
            choice: null,
            menuTexts: null,
            showMenu: false,
            inGameMenu: false,
            teleportMenu: false,
            enteredVR: false
        };

        clock.start();
        this.preloadPromise = this.preload(game);
    }

    async preload(game) {
        await game.registerResources();
        await game.preload();
        const vrScene = loadVRScene(game, this.state.sceneManager, this.state.renderer);
        this.setState({ vrScene });
        this.onGameReady();
    }

    setUiState(state, callback) {
        this.setState(state, () => {
            if (callback) {
                callback();
            }
        });
    }

    @pure()
    getUiState() {
        return this.state;
    }

    async onWrapperRef(wrapperElem) {
        if (!this.wrapperElem && wrapperElem) {
            this.state.renderer.threeRenderer.setAnimationLoop(() => {
                this.props.ticker.frame();
            });
            this.onSceneManagerReady(this.state.sceneManager);
            const { sceneManager, game, renderer } = this.state;
            const controls = [
                new VRControls(this.props.params, sceneManager, game, renderer)
            ];
            this.setState({ controls });
            this.wrapperElem = wrapperElem;
            this.wrapperElem.appendChild(this.canvas);
        }
    }

    async onSceneManagerReady(sceneManager) {
        if (this.props.params.scene >= 0) {
            await this.preloadPromise;
            sceneManager.hideMenuAndGoto(this.props.params.scene);
        }
    }

    componentWillMount() {
        super.componentWillMount();
    }

    componentWillUnmount() {
        super.componentWillUnmount();
    }

    onGameReady() {
        this.state.game.loaded('game');
        if (this.props.params.scene === -1) {
            this.showMenu();
        }
    }

    showMenu(inGameMenu = false) {
        this.state.game.pause();
        const audio = this.state.game.getAudioManager();
        audio.playMusicTheme();
        this.setState({showMenu: true, inGameMenu});
    }

    hideMenu(wasPaused = false) {
        const audio = this.state.game.getAudioManager();
        audio.stopMusicTheme();
        if (!wasPaused)
            this.state.game.resume();
        this.setState({showMenu: false, inGameMenu: false});
        this.canvas.focus();
    }

    frame() {
        const {game, clock, renderer, sceneManager, controls, vrScene} = this.state;
        if (renderer && sceneManager) {
            if (this.props.params.vrEmulator) {
                this.checkResizeForVREmulator();
            }
            const presenting = renderer.isPresenting();
            const scene = sceneManager.getScene();
            if (this.state.scene !== scene) {
                this.setState({scene});
            }
            mainGameLoop(
                this.props.params,
                game,
                clock,
                renderer,
                scene,
                controls,
                vrScene
            );
            if (vrScene) {
                updateVRScene(
                    vrScene,
                    presenting,
                    game,
                    sceneManager
                );
            }
        }
    }

    checkResizeForVREmulator() {
        if (this.wrapperElem && this.canvas && this.state.renderer) {
            const { clientWidth, clientHeight } = this.wrapperElem;
            const rWidth = `${clientWidth}px`;
            const rHeight = `${clientHeight}px`;
            const style = this.canvas.style;
            if (rWidth !== style.width || rHeight !== style.height) {
                this.state.renderer.resize(clientWidth, clientHeight);
            }
        }
    }

    render() {
        return <div ref={this.onWrapperRef} style={fullscreen}>
            <div className="canvasWrapper" style={fullscreen}/>
            {this.renderGUI()}
        </div>;
    }

    renderGUI() {
        if (this.session && this.session.visibilityState !== 'hidden')
            return null;

        return <React.Fragment>
            {this.renderVRSelector()}
            {this.state.loading ? <Loader/> : null}
        </React.Fragment>;
    }

    async requestPresence() {
        if (!this.state.renderer) {
            return;
        }
        this.state.game.getAudioManager().resumeContext();
        this.session = await (navigator as any).xr.requestSession('immersive-vr');
        this.session.addEventListener('end', this.onSessionEnd);
        this.state.renderer.threeRenderer.xr.setSession(this.session);
        this.setState({ enteredVR: true });
    }

    onSessionEnd() {
        this.session.removeEventListener('end', this.onSessionEnd);
        this.session = null;
        this.forceUpdate();
    }

    exitVR() {
        this.state.game.getAudioManager().stopMusicTheme();
        this.props.exitVR();
    }

    renderVRSelector() {
        if (!this.state.renderer) {
            return null;
        }
        const buttonWrapperStyle = {
            position: 'absolute' as const,
            left: 0,
            right: 0,
            bottom: 20,
            textAlign: 'center' as const,
            verticalAlign: 'middle' as const
        };
        const imgStyle = {
            width: 200,
            height: 200
        };
        const buttonStyle = {
            color: 'white',
            background: 'rgba(32, 162, 255, 0.5)',
            userSelect: 'none' as const,
            cursor: 'pointer' as const,
            display: 'inline-block' as const,
            fontFamily: 'LBA',
            padding: 20,
            textShadow: 'black 3px 3px',
            border: '2px outset #61cece',
            borderRadius: '15px',
            fontSize: '30px',
            textAlign: 'center' as const,
            verticalAlign: 'middle' as const
        };
        const buttonStyle2 = Object.assign({}, buttonStyle, {
            padding: 10,
            fontSize: '20px'
        });
        return <div className="bgMenu fullscreen">
            <div style={buttonWrapperStyle}>
                <div style={buttonStyle} onClick={this.requestPresence}>
                    <img style={imgStyle} src="images/vr_goggles.png"/>
                    <br/>
                    {this.state.enteredVR ? tr('ReturnToVR') : tr('PlayInVR')}
                </div>
                <br/><br/>
                {!this.state.enteredVR && <div style={buttonStyle2} onClick={this.exitVR}>
                    {tr('PlayOnScreen')}
                </div>}
            </div>
        </div>;
    }
}
