import React from 'react';

import '../styles/behaviour.scss';

interface IBehaviourMenuClover {
    boxes: number;
    leafs: number;
}

interface IBehaviourMenuMagicBall {
    level: number;
    strength: number;
    bounce: number;
}

interface IBehaviourMenuProps {
    game: any;
}

interface IBehaviourMenu {
    behaviour: number;
    life: number;
    money: number;
    magic: number;
    keys: number;
    clover: IBehaviourMenuClover;
    magicball: IBehaviourMenuMagicBall;
}

const BehaviourModeItem = (props: any) => (
    <div
        className={`behaviourItem${props.selected ? ' selected' : ''}`}
        {...props}
    >
    </div>
);

const BehaviourMode = ({ game, behaviour }) => {
    const behaviourText = (game.menuTexts)
    ? game.menuTexts[80 + behaviour].value : '';
    return (
        <div className="behaviourMode">{behaviourText}</div>
    );
};

const BehaviourCount = ({ type, value }: { type: 'keys' | 'money', value: number}) => {
    return (
        <div className={`count ${type}`}>{value}</div>
    );
};

const BehavourPointProgress = ({ type, value, maxValue, size }
    : { type: 'magic' | 'life', value: number, maxValue: number, size?: number }) => {
        let maxWidth = 480;
        if (type === 'magic') {
            maxWidth = Math.floor(maxWidth / (4 - size));
        }
        const width = (value * maxWidth) / maxValue;
    return (
        maxValue > 0 ?
            <div className="pointsProgress" style={{
                    width: maxWidth,
                }}
            >
                <div className={`progress ${type}`} style={{
                    borderTopRightRadius: value === maxValue ? 15 : 0,
                    borderBottomRightRadius: value === maxValue ? 15 : 0,
                    width,
                }}>
                </div>
            </div>
        : null
    );
};

const BehaviourClovers = ({ boxes, leafs}: IBehaviourMenuClover) => {
    return (
        <div>{boxes}{leafs}</div>
    );
};

// @ts-ignore
const BehaviourMenu = ({ game }: IBehaviourMenuProps) => {
    const {
        behaviour,
        life,
        money,
        magic,
        keys,
        clover,
        magicball
    }: IBehaviourMenu = game.getState().hero;
    return (
        <div className="behaviourMenu">
            <div className="behaviourContainer">
                <div className="behaviourItemContainer">
                    <BehaviourModeItem selected={behaviour === 0} />
                    <BehaviourModeItem selected={behaviour === 1} />
                    <BehaviourModeItem selected={behaviour === 2} />
                    <BehaviourModeItem selected={behaviour === 3} style={{
                        marginRight: '0px'
                    }} />
                </div>
                <BehaviourMode game={game} behaviour={behaviour} />
            </div>
            <div className="behaviourContainer points">
                <BehaviourCount type="money" value={money} />
                <BehaviourCount type="keys" value={keys} />
                <BehavourPointProgress
                    type="life"
                    value={life}
                    maxValue={255}
                />
                <BehavourPointProgress
                    type="magic"
                    value={magic}
                    maxValue={(magicball.level) * 20}
                    size={magicball.level}
                />
                <BehaviourClovers boxes={clover.boxes} leafs={clover.leafs} />
            </div>
        </div>
    );
};

export default BehaviourMenu;
