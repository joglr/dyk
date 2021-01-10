import { Fade, Grow } from "@material-ui/core";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import styled from "styled-components";
import {
  useClampedState,
  useKeyBinding,
  useKeys,
  useLocalStorage,
  useResetableState,
} from "./hooks";
import { dist, pick } from "./util";
import pkg from "./../package.json";

const W = () => window.innerWidth;
const H = () => window.innerHeight;
const GAME_DURATION = 30;
const BREATH_DURATION = 3;
const PLAYER_SIZE = 32;
const JUMP_ACCELERATION = 70;
const GRAVITY_ACCELERATION = 1 / 5;
const MIN_COORD = PLAYER_SIZE / 2;
const FRICTION_COEFFICIENT = 1 - 1 / 100;
const PLAYER_SPEED = 2;
const OCEAN_LEVEL_FRACTION = 0.4;
const getOceanLevel = () => OCEAN_LEVEL_FRACTION * H();
const TIMED_HIGH_SCORE_STORAGE_KEY = "timed_highscore";

const Z = {
  SKY: -200,
  FISH: -20 % 100,
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
  position: absolute;
  top: ${PLAYER_SIZE}px;
  left: ${PLAYER_SIZE}px;
  font-size: 300%;
  font-weight: bold;
`;

const H1 = styled.h1`
  margin-bottom: 0.5em;
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
  height: ${100 - OCEAN_LEVEL_FRACTION * 100}%;
  z-index: ${Z.SKY};
  background-color: hsl(232deg 100% 89%);
`;

const Ocean = styled.div`
  background-color: hsl(229 100% 50% / 0.6);
  height: ${OCEAN_LEVEL_FRACTION * 100}%;
  z-index: ${Z.OCEAN};
`;

const BreathMeter = styled.div.attrs((p: { ratio: number }) => ({
  style: {
    width: `${p.ratio * 100}%`,
  },
}))<{ ratio: number }>`
  height: 20px;
  width: 0;
  background-color: red;
  position: absolute;
  top: 0;
  left: 0;
`;

const Entity = styled.div.attrs((p: any) => ({
  style: {
    transform: `translate(${p.pos[0]}px, ${H() - p.pos[1]}px)`,
  },
}))<any>`
  will-change: transform;
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

const EntityIcon = styled.div<any>`
  width: ${PLAYER_SIZE}px;
  height: ${PLAYER_SIZE}px;
  font-size: ${PLAYER_SIZE}px;
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
const Key = styled.span`
  background-color: #fff;
  box-shadow: 0 0 0 2px black inset, 0 0 4px 0 black inset;

  border-radius: 15px;
  padding: 0 7px;
  /* margin: -15px 0; */
`;

const HelpText = styled.div`
  position: absolute;
  top: 0;
  line-height: 125%;
  div:not(${Key}) {
    /* -webkit-text-stroke: 1px #fff; */
  }
`;

const Controls = styled.div`
  margin-top: 20px;
  font-size: 70%;
`;

const GameOver = styled.div`
  color: red;
`;

const Version = styled.div`
  font-size: 50%;
`;

const FISH = ["🐡", "🐟", "🐠", "🦐"];
const ENEMIES: string[] = ["🦈", "🦑"];

const EnemyNames: { [enemy: string]: string } = {
  "🦈": "a shark",
  "🦑": "an octopus",
};

interface State {
  gameStatus: "IDLE" | "POST_GAME" | "RUNNING";
  gameStartTime: number | null;
  endReason: string | null;
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
      reason: string;
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
        endReason: null,
      };
    case END:
      return {
        gameStatus: "POST_GAME",
        gameStartTime: null,
        score: prevState.score,
        endReason: action.reason,
      };
    case SCORE:
      return {
        gameStatus: prevState.gameStatus,
        gameStartTime: (prevState.gameStartTime as number) + 1000,
        score: prevState.score + action.value,
        endReason: null,
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
    endReason: null,
  };
}

function generateFish(count: number, onlyFish = false) {
  let fish = [];

  for (let i = 0; i < count; i++) {
    fish.push({
      id: Symbol(),
      x: Math.random() * W(),
      y: getOceanLevel() * Math.random(),
      vx: Math.random() - 0.5,
      vy: 0,
      icon: pick([...FISH, ...(onlyFish ? [] : ENEMIES)]),
    });
  }

  return fish;
}

export default function App() {
  const [debug, setDebug] = useState(false);

  const [
    { gameStartTime, gameStatus, score, endReason },
    dispatch,
  ] = useReducer<Reducer<State, Action>>(gameStateReducer, getInitialState());

  const [highScore, setHighScore] = useLocalStorage<number | null>(
    TIMED_HIGH_SCORE_STORAGE_KEY,
    null
  );

  const [vx, setVx, resetVx] = useClampedState(-10, 10, 0);
  const [vy, setVy, resetVy] = useClampedState(-10, 10, 0);
  const [x, setX, resetX] = useClampedState(
    MIN_COORD,
    W() - MIN_COORD,
    W() / 2
  );
  const [y, setY, resetY] = useClampedState(
    MIN_COORD,
    ((1 - OCEAN_LEVEL_FRACTION) / 2 + OCEAN_LEVEL_FRACTION) * H(),
    ((1 - OCEAN_LEVEL_FRACTION) / 2 + OCEAN_LEVEL_FRACTION) * H()
  );

  const [caughtFish, setCaughtFish] = useResetableState<Symbol | null>(null);
  const [diveTime, setDiveTime, resetDiveTime] = useResetableState<
    number | null
  >(null);
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
    resetDiveTime();
  }

  const endGame = useCallback(
    (reason) => {
      if (gameStatus === "RUNNING") {
        if (!highScore || score > highScore) {
          setHighScore(score);
        }
        dispatch({ type: END, reason });
      }
    },
    [gameStatus, highScore, score, setHighScore]
  );

  const lastFrameRef = useRef(0);
  const frameRate = useRef(0);

  const keys = useKeys();

  useEffect(() => {
    let canceled = false;

    if (gameStatus === "RUNNING") {
      if (y < getOceanLevel() && !diveTime) {
        setDiveTime(new Date().getTime());
      }
      if (y > getOceanLevel() && diveTime) {
        resetDiveTime();
      }

      setFish((fish) => {
        let fishInProximity: [Symbol, number][] = [];

        for (let f of fish) {
          const distance = dist({ x, y }, f);
          if (distance < PLAYER_SIZE) {
            if (ENEMIES.includes(f.icon)) {
              if (!canceled) endGame("You were eaten by " + EnemyNames[f.icon]);
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
          if (y > getOceanLevel()) {
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
    setDiveTime,
    diveTime,
    x,
    y,
    resetDiveTime,
    endGame,
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
          case "a":
            startGame();
            if (gameStatus !== "RUNNING") return;
            setVx((_x: number) => -PLAYER_SPEED);

            break;

          case "ArrowRight":
          case "d":
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

  const diveDurationInSeconds =
    diveTime !== null ? (new Date().getTime() - diveTime) / 1000 : null;

  useEffect(() => {
    if (timeElapsedInSeconds && timeElapsedInSeconds >= GAME_DURATION) {
      endGame("Times up!");
    }
    if (diveDurationInSeconds && diveDurationInSeconds >= BREATH_DURATION) {
      endGame("You drowned");
    }
  }, [timeElapsedInSeconds, diveDurationInSeconds, endGame]);

  useKeyBinding("r", () => {
    if (gameStatus === "RUNNING") reset();
  });
  useKeyBinding("d", () => setDebug((debug) => !debug));

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
          </Debug>
        </Grow>
        <Grow in={gameStatus === "RUNNING"}>
          <BreathMeter
            ratio={
              diveDurationInSeconds
                ? diveDurationInSeconds / BREATH_DURATION
                : 0
            }
          />
        </Grow>
        <Sky />
        <Ocean>
          {fish.map((fish) => (
            <Fade key={String(fish.id)} in={true} appear>
              <Entity
                style={{
                  zIndex: Z.FISH,
                }}
                pos={[fish.x, fish.y]}
              >
                <EntityIcon direction={fish.vx > 0}>{fish.icon}</EntityIcon>
              </Entity>
            </Fade>
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
          <div>
            Score: {Math.round(score)}
            {gameStatus === "POST_GAME" && highScore && (
              <>, high score: {highScore}</>
            )}
          </div>
        </Grow>
        <Grow in={gameStatus === "RUNNING"}>
          <div>
            {Math.round(GAME_DURATION - (timeElapsedInSeconds as number))}s
          </div>
        </Grow>
        <Grow in={gameStatus === "POST_GAME"}>
          <div>
            <GameOver>Game over!</GameOver>
            <div>{endReason}</div>
            <TryAgainButton onClick={reset}>Try again</TryAgainButton>
          </div>
        </Grow>
        <Grow in={gameStatus === "IDLE"}>
          <HelpText>
            <H1>Plummet 🦅</H1>
            <div>
              {" >"} Press any key to start! {" < "}
            </div>
            <Controls>
              <div>
                <Key>⬅</Key> <Key>➡</Key> or <Key>A</Key> <Key>D</Key> to move.
                Hold <Key>space</Key> to dive
              </div>
              <div>
                Catch {FISH.join("")}, avoid {ENEMIES.join("")}!
              </div>
              <div>
                You got <u>{GAME_DURATION}</u> seconds, watch your breath!
              </div>
              {highScore && <div>Your high score: {highScore}</div>}
              <Version>Version {pkg.version}</Version>
            </Controls>
          </HelpText>
        </Grow>
      </Overlay>
    </>
  );
}
