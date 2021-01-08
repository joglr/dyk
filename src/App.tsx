import { Fade, Grow } from "@material-ui/core";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import {
  useClampedState,
  useKeyBinding,
  useKeys,
  useResetableState,
} from "./hooks";
import { dist, pick } from "./util";

const W = () => window.innerWidth;
const H = () => window.innerHeight;
const PLAYER_SIZE = 24;
const JUMP_ACCELERATION = 70;
const GRAVITY_ACCELERATION = 1 / 5;
const MIN_COORD = PLAYER_SIZE / 2;
const FRICTION_COEFFIENT = 1 - 1 / 100;
const PLAYER_SPEED = 2;
const SEA_LEVEL = 0.2 * H();

const Z = {
  SKY: -200,
  FISH: -100,
  OCEAN: 100,
};

export interface IPositioned {
  x: number;
  y: number;
}

export interface IEntity extends IPositioned {
  id: Symbol;
  vx: number;
  vy: number;
  icon: string;
}

interface IFish extends IEntity {}

const Overlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
`;

const World = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  overflow: hidden;
`;

const Sky = styled.div`
  height: 80%;
  z-index: ${Z.SKY};
  background-color: hsl(232deg 100% 89%);
`;

const Ocean = styled.div`
  background-color: hsl(229 100% 50% / 0.6);
  /* background-color: hsla(200, 100%, 20%, 0.3); */
  height: 20%;
  z-index: ${Z.OCEAN};
`;

const Entity = styled.div.attrs((p: any) => ({
  style: {
    transform: `translate(${p.pos[0]}px, ${H() - p.pos[1]}px)`,
  },
}))<any>`
  position: absolute;
  height: 0;
  width: 0;
  top: 0;
  left: 0;
`;

const Debug = styled.code`
  /* font-family: monospace; */
`;

const EntityIcon = styled.div<any>`
  width: ${PLAYER_SIZE}px;
  height: ${PLAYER_SIZE}px;
  font-size: ${PLAYER_SIZE}px;
  transition: transform 0.25s;
  transform: translate(-50%, calc(-50% - 5px))
    rotateY(${(p) => (p.direction ? "180deg" : "0")});
`;

const Score = styled.div<{ expanded: boolean }>`
  transition: 1s font-size;
  position: absolute;
  top: ${(p) => (p.expanded ? "50%" : `${PLAYER_SIZE}px`)};
  left: 50%;
  transform: translateX(-50%);

  font-size: ${(p) => (p.expanded ? 600 : 200)}%;
  font-weight: bold;
`;

const TryAgainButton = styled.button``;

const Lives = styled.div`
  color: red;
`;

const FISH = ["🐡", "🐟", "🦐"];
const ENEMIES: string[] = ["🦈", "🦑"];

function generateFish(count: number) {
  let fish = [];

  for (let i = 0; i < count; i++) {
    fish.push({
      id: Symbol(),
      x: Math.random() * W(),
      y: SEA_LEVEL * Math.random(),
      vx: Math.random() - 0.5,
      vy: 0,
      icon: pick([...FISH, ...ENEMIES]),
    });
  }

  return fish;
}

export default function App() {
  const [debug, setDebug] = useState(false);

  const [vx, setVx, resetVx] = useClampedState(-10, 10, 0);
  const [vy, setVy, resetVy] = useClampedState(-10, 10, 0);
  const [x, setX, resetX] = useClampedState(
    MIN_COORD,
    W() - MIN_COORD,
    W() / 2
  );
  const [y, setY, resetY] = useClampedState(MIN_COORD, H() / 2, H() / 2);

  const [caughtFish, setCaughtFish] = useResetableState<Symbol | null>(null);

  const [isDiving, setIsDiving] = useResetableState(false);
  const [lives, setLives, resetLives] = useResetableState(3);
  const [score, setScore, resetScore] = useResetableState(0);

  const [fish, setFish, resetFish] = useResetableState<IFish[]>(() =>
    generateFish(10)
  );

  function reset() {
    resetX();
    resetY();
    resetVx();
    resetVy();
    resetFish();
    resetLives();
    resetScore();
  }

  const lastFrameRef = useRef(0);
  const frameRate = useRef(0);

  const keys = useKeys();

  useEffect(() => {
    setFish((fish) => {
      if (caughtFish === null) {
        let fishInProximity: [Symbol, number][] = [];
        for (let f of fish) {
          const distance = dist({ x, y }, f);
          if (distance < PLAYER_SIZE) {
            if (ENEMIES.includes(f.icon)) {
              setLives((prevLives) => prevLives - 1);
              resetX();
              resetY();
              resetVx();
              resetVy();
            } else if (FISH.includes(f.icon)) {
              fishInProximity.push([f.id, distance]);
            }
          }
        }
        if (fishInProximity.length > 0) {
          let closestFish = fishInProximity.sort(([, d1], [, d2]) => {
            return d1 - d2;
          })[0];
          setCaughtFish(closestFish[0]);
        }
        return fish;
      } else {
        if (y > SEA_LEVEL) {
          setCaughtFish(null);
          setScore(
            (prevScore) =>
              prevScore +
              1 +
              (fish.find((f) => f.id === caughtFish) as IFish).vx
          );
          return [
            ...fish.filter((f) => f.id !== caughtFish),
            ...generateFish(1),
          ];
        }
        return fish.map((f) => {
          if (f.id === caughtFish) {
            return {
              ...f,
              x: x,
              y: y - PLAYER_SIZE,
              vx: 0,
              vy: 0,
            };
          } else return f;
        });
      }
    });
  }, [
    caughtFish,
    resetVx,
    resetVy,
    resetX,
    resetY,
    setCaughtFish,
    setFish,
    setLives,
    setScore,
    x,
    y,
  ]);

  useEffect(() => {
    function update(timestamp: number) {
      frameRate.current = 1 / ((timestamp - lastFrameRef.current) / 1000);
      lastFrameRef.current = timestamp;

      setFish((prevFish) => {
        const fishClone = prevFish.map((f) => {
          if (f.id === caughtFish) return f;
          return {
            ...f,
            x: f.x + f.vx,
            y: H() * 0.1 + H() * 0.02 * Math.sin(f.x / 10),
            ...(f.x < 0 || f.x > W()
              ? {
                  x: f.x < 0 ? 0 : W(),
                  vx: -vx,
                }
              : {}),
          };
        });
        return fishClone;
      });

      setX((prevX: number) => prevX + vx);
      setY((prevY: number) => prevY + vy);
      // Drag
      setVx((prevVx: number) => prevVx * FRICTION_COEFFIENT);

      setVy((_pvy: number) =>
        isDiving ? -30 * GRAVITY_ACCELERATION : 30 * GRAVITY_ACCELERATION
      );

      let spacePressed = false;

      for (let key of keys) {
        switch (key) {
          case " ":
            spacePressed = true;
            if (!isDiving) {
              if (keys.includes("ArrowLeft")) setVx(-1 * JUMP_ACCELERATION);
              else if (keys.includes("ArrowRight")) setVx(JUMP_ACCELERATION);
              // setVy(-JUMP_ACCELERATION);
              setIsDiving(true);
            }
            break;

          case "ArrowLeft":
            setVx((_x: number) => -PLAYER_SPEED);

            break;

          case "ArrowRight":
            setVx((_x: number) => PLAYER_SPEED);
            break;
          default:
        }
      }

      if (!spacePressed) setIsDiving(false);
    }
    const frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  });

  useKeyBinding("d", () => setDebug((debug) => !debug), true);

  const oceanRef = useRef<HTMLElement>();

  return (
    <>
      <World>
        <Sky />
        <Ocean ref={oceanRef as any}>
          {fish.map((fish, i) => (
            <Grow in={true} key={i}>
              <Entity
                style={{
                  zIndex: Z.FISH,
                }}
                pos={[fish.x, fish.y]}
              >
                <EntityIcon direction={fish.vx > 0}>{fish.icon}</EntityIcon>
              </Entity>
            </Grow>
          ))}
        </Ocean>
        {lives > 0 && (
          <Entity pos={[x, y]}>
            <EntityIcon direction={vx > 0}>🦅</EntityIcon>
          </Entity>
        )}
      </World>

      <Overlay>
        <Grow in={debug}>
          <Debug>
            <div>fps: {frameRate.current.toFixed(0)}</div>
            <div>x: {x.toFixed(0)}</div>
            <div>y: {y.toFixed(0)}</div>
            <div>vx: {vx.toFixed(0)}</div>
            <div>vy: {vy.toFixed(0)}</div>
            <div>isDiving: {isDiving.toString()}</div>
            <div>caughtFish: {caughtFish}</div>
          </Debug>
        </Grow>

        <Score expanded={lives === 0}>
          {lives > 0 ? (
            <Lives>
              {[...new Array(3)].map((_, i) => (
                <Fade in={lives - 1 >= i} key={i}>
                  <span>❤</span>
                </Fade>
              ))}
            </Lives>
          ) : (
            <div>
              <div>You died!</div>
            </div>
          )}
          <div>Score: {Math.round(score)}</div>
          <Grow in={lives === 0}>
            <TryAgainButton onClick={reset}>Try again</TryAgainButton>
          </Grow>
        </Score>
      </Overlay>
    </>
  );
}
