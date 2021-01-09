import { Grow } from "@material-ui/core";
import { useEffect, useReducer, useRef, useState } from "react";
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
const GAME_DURATION = 30;
const PLAYER_SIZE = 24;
const JUMP_ACCELERATION = 70;
const GRAVITY_ACCELERATION = 1 / 5;
const MIN_COORD = PLAYER_SIZE / 2;
const FRICTION_COEFFICIENT = 1 - 1 / 100;
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
  transition: 1s font-size;
  position: absolute;
  top: ${PLAYER_SIZE}px;
  left: ${PLAYER_SIZE}px;
  font-size: 400%;
  font-weight: bold;
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
  position: absolute;
  bottom: 0;
  font-family: monospace;
`;

const HelpText = styled.div`
  position: absolute;
  top: 0;
`;

const EntityIcon = styled.div<any>`
  width: ${PLAYER_SIZE}px;
  height: ${PLAYER_SIZE}px;
  font-size: ${PLAYER_SIZE}px;
  transition: transform 0.25s;
  transform: translate(-50%, calc(-50% - 5px))
    rotateY(${(p) => (p.direction ? "180deg" : "0")});
`;

const TryAgainButton = styled.button`
  font-size: 50%;
  background: none;
  text-transform: uppercase;
  border: 2px black solid;
  border-radius: 120px;
  padding: 15px;
  &:hover {
    background-color: #eee;
    cursor: pointer;
  }
`;

const GameOver = styled.div`
  color: red;
`;

const FISH = ["🐡", "🐟", "🦐"];
const ENEMIES: string[] = ["🦈", "🦑"];

interface State {
  gameStatus: "IDLE" | "POST_GAME" | "RUNNING";
  gameStartTime: number | null;
  score: number;
}

enum ActionType {
  START,
  END,
  SCORE,
  RESET,
}

type Action =
  | {
      type: ActionType.START;
    }
  | {
      type: ActionType.END;
    }
  | {
      type: ActionType.RESET;
    }
  | {
      type: ActionType.SCORE;
      value: number;
    };

type Reducer<S, A> = (prevState: S, action: A) => S;

const { START, END, SCORE, RESET } = ActionType;

function gameStateReducer(prevState: State, action: Action): State {
  switch (action.type) {
    case START:
      return {
        gameStatus: "RUNNING",
        gameStartTime: new Date().getTime(),
        score: 0,
      };
    case END:
      return {
        gameStatus: "POST_GAME",
        gameStartTime: null,
        score: prevState.score,
      };
    case SCORE:
      return {
        gameStatus: prevState.gameStatus,
        gameStartTime: prevState.gameStartTime,
        score: prevState.score + action.value,
      };
    case RESET:
      return getInitialState();
  }
}

function getInitialState(): State {
  return {
    gameStatus: "IDLE",
    gameStartTime: null,
    score: 0,
  };
}

function generateFish(count: number, onlyFish = false) {
  let fish = [];

  for (let i = 0; i < count; i++) {
    fish.push({
      id: Symbol(),
      x: Math.random() * W(),
      y: SEA_LEVEL * Math.random(),
      vx: Math.random() - 0.5,
      vy: 0,
      icon: pick([...FISH, ...(onlyFish ? [] : ENEMIES)]),
    });
  }

  return fish;
}

export default function App() {
  const [debug, setDebug] = useState(false);

  const [{ gameStartTime, gameStatus, score }, dispatch] = useReducer<
    Reducer<State, Action>
  >(gameStateReducer, getInitialState());

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

  const [fish, setFish, resetFish] = useResetableState<IFish[]>(() =>
    generateFish(10)
  );

  function reset() {
    resetFish();
    dispatch({ type: RESET });
    resetX();
    resetY();
    resetVx();
    resetVy();
  }

  const lastFrameRef = useRef(0);
  const frameRate = useRef(0);

  const keys = useKeys();

  useEffect(() => {
    let canceled = false;

    if (gameStatus === "RUNNING") {
      setFish((fish) => {
        let fishInProximity: [Symbol, number][] = [];

        for (let f of fish) {
          const distance = dist({ x, y }, f);
          if (distance < PLAYER_SIZE) {
            if (ENEMIES.includes(f.icon)) {
              if (!canceled) dispatch({ type: END });
              resetX();
              resetY();
              resetVx();
              resetVy();
            } else if (FISH.includes(f.icon) && caughtFish === null) {
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

        if (caughtFish !== null) {
          if (y > SEA_LEVEL) {
            setCaughtFish(null);
            const cf = fish.find((f) => f.id === caughtFish);
            if (cf) {
              dispatch({
                type: SCORE,
                value: 1 + Math.abs(cf.vx),
              });
              const fishLeft = fish.filter((f) => f.id !== caughtFish);
              return [
                ...fishLeft,
                ...generateFish(
                  1 + Math.floor(Math.random() * 3),
                  Boolean(fishLeft.find((f) => FISH.includes(f.icon)))
                ),
              ];
            }
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

        return fish;
      });
    }
    return () => void (canceled = true);
  }, [
    caughtFish,
    gameStatus,
    resetVx,
    resetVy,
    resetX,
    resetY,
    setCaughtFish,
    setFish,
    x,
    y,
  ]);

  function startGame() {
    if (gameStatus === "IDLE") {
      dispatch({ type: START });
    }
  }

  useEffect(() => {
    function update(timestamp: number) {
      if (gameStatus === "RUNNING") {
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
        setVx((prevVx: number) => prevVx * FRICTION_COEFFICIENT);

        setVy((_pvy: number) =>
          isDiving ? -30 * GRAVITY_ACCELERATION : 30 * GRAVITY_ACCELERATION
        );
      }
      let spacePressed = false;
      for (let key of keys) {
        switch (key) {
          case " ":
            startGame();
            if (gameStatus !== "RUNNING") return;
            spacePressed = true;
            if (!isDiving) {
              if (keys.includes("ArrowLeft")) setVx(-1 * JUMP_ACCELERATION);
              else if (keys.includes("ArrowRight")) setVx(JUMP_ACCELERATION);
              // setVy(-JUMP_ACCELERATION);
              setIsDiving(true);
            }
            break;

          case "ArrowLeft":
            startGame();
            if (gameStatus !== "RUNNING") return;
            setVx((_x: number) => -PLAYER_SPEED);

            break;

          case "ArrowRight":
            startGame();
            if (gameStatus !== "RUNNING") return;
            setVx((_x: number) => PLAYER_SPEED);
            break;
          default:
        }
      }

      if (gameStatus !== "RUNNING") return;
      if (!spacePressed) setIsDiving(false);
    }
    const frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  });

  const timeElapsedInSeconds =
    gameStartTime !== null
      ? (new Date().getTime() - gameStartTime) / 1000
      : null;

  useEffect(() => {
    if (timeElapsedInSeconds && timeElapsedInSeconds >= GAME_DURATION) {
      dispatch({ type: END });
    }
  }, [timeElapsedInSeconds]);

  useKeyBinding("d", () => setDebug((debug) => !debug), true);

  const oceanRef = useRef<HTMLElement>();

  return (
    <>
      <World>
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
        <Sky />
        <Ocean ref={oceanRef as any}>
          {fish.map((fish, i) => (
            <Grow key={i} in={true} appear>
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
        {gameStartTime && (
          <Entity pos={[x, y]}>
            <EntityIcon direction={vx > 0}>🦅</EntityIcon>
          </Entity>
        )}
      </World>

      <Overlay>
        <Grow
          in={gameStatus === "POST_GAME" || gameStatus === "RUNNING"}
          appear
        >
          <div>Score: {Math.round(score)}</div>
        </Grow>
        <Grow in={gameStatus === "RUNNING"}>
          <div>
            {Math.round(GAME_DURATION - (timeElapsedInSeconds as number))}s
          </div>
        </Grow>
        <Grow in={gameStatus === "POST_GAME"}>
          <div>
            <GameOver>Game over!</GameOver>
            <TryAgainButton onClick={reset}>Try again</TryAgainButton>
          </div>
        </Grow>
        <Grow in={gameStatus === "IDLE"}>
          <HelpText>
            <div>Press ⬅, ➡ or [space] to start game!</div>
            <br />
            <div
              style={{
                fontSize: "70%",
              }}
            >
              Catch {FISH.join("")}, but avoid {ENEMIES.join("")}!
            </div>
          </HelpText>
        </Grow>
      </Overlay>
    </>
  );
}
