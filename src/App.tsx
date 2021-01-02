import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useClampedState, useKeys } from "./hooks";
import { pick } from "./util";

const W = () => window.innerWidth;
const H = () => window.innerHeight;
const PLAYER_SIZE = 24;
const JUMP_ACCELERATION = 70;
const GRAVITY_ACCELERATION = 1 / 5;
const MIN_COORD = PLAYER_SIZE / 2;
const FRICTION_COEFFIENT = 1 - 1 / 100;
const PLAYER_SPEED = 2;
const SEA_LEVEL = 0.2 * H();

interface IEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  icon: string;
}

interface IFish extends IEntity {}

const World = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  overflow: hidden;
  background-color: #5e89ff;
`;

const Ocean = styled.div`
  background-color: hsla(200, 100%, 20%, 0.3);
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  top: 80%;
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

const PlayerIcon = styled.div<any>`
  width: ${PLAYER_SIZE}px;
  height: ${PLAYER_SIZE}px;
  font-size: ${PLAYER_SIZE}px;
  transition: transform 0.25s;
  transform: translate(-50%, calc(-50% - 5px))
    rotateY(${(p) => (p.dir ? "180deg" : "0")});
`;

function generateFish(count: number) {
  let fish = [];

  for (let i = 0; i < count; i++) {
    fish.push({
      x: Math.random() * W(),
      y: SEA_LEVEL * Math.random(),
      vx: Math.random() - 0.5,
      vy: 0,
      icon: pick(["🐡", "🐟"]),
    });
  }

  return fish;
}

export default function App() {
  const [vx, setVx] = useClampedState(-10, 10, 0);
  const [vy, setVy] = useClampedState(-10, 10, 0);
  const [isJumping, setHasJumped] = useState(false);

  const [fish, setFish] = useState<IFish[]>(() => generateFish(10));

  const [x, setX] = useClampedState(MIN_COORD, W() - MIN_COORD, W() / 2);
  const [y, setY] = useClampedState(
    SEA_LEVEL,
    H() - MIN_COORD,
    SEA_LEVEL + MIN_COORD
  );

  // const [dir, setDir] = useState(false);

  const lastFrameRef = useRef(0);
  const frameRate = useRef(0);

  const keys = useKeys();

  useEffect(() => {
    if (y === SEA_LEVEL) {
      setHasJumped(false);
    }
  }, [y]);

  // useEffect(() => {
  //   if (!keys.includes(" ")) setHasJumped(false);
  // }, [keys.includes(" ")]);

  useEffect(() => {
    function update(timestamp: number) {
      frameRate.current = 1 / ((timestamp - lastFrameRef.current) / 1000);
      lastFrameRef.current = timestamp;

      setFish((prevFish) => {
        const fishClone = prevFish.map((fish) => ({
          ...fish,
          x: fish.x + fish.vx,
          ...(fish.x < 0 || fish.x > W()
            ? {
                x: fish.x < 0 ? 0 : W(),
                vx: -vx,
              }
            : {}),
        }));
        return fishClone;
      });

      setX((prevX: number) => prevX + vx);
      setY((prevY: number) => prevY + vy);
      // Drag
      setVx((prevVx: number) => prevVx * FRICTION_COEFFIENT);
      // Gravity
      setVy(
        (pvy: number) =>
          pvy -
          (keys.includes(" ")
            ? GRAVITY_ACCELERATION * 0.1
            : GRAVITY_ACCELERATION)
      );

      for (let key of keys) {
        switch (key) {
          case " ":
            if (!isJumping) {
              if (keys.includes("ArrowLeft")) setVx(-1 * JUMP_ACCELERATION);
              else if (keys.includes("ArrowRight")) setVx(JUMP_ACCELERATION);
              setVy(JUMP_ACCELERATION);
              setHasJumped(true);
            }
            break;
          // case "ArrowUp":
          //   setY((y: number) => y - PLAYER_SPEED);
          //   break;

          // case "ArrowDown":
          //   setY((y: number) => y + PLAYER_SPEED);
          //   break;

          case "ArrowLeft":
            setX((x: number) => x - PLAYER_SPEED);

            break;

          case "ArrowRight":
            setX((x: number) => x + PLAYER_SPEED);
            break;
          default:
        }
      }
    }
    const frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  });

  return (
    <World>
      <Ocean></Ocean>
      <Entity pos={[x, y]}>
        <PlayerIcon dir={vx > 0}>🦅</PlayerIcon>
      </Entity>
      {fish.map((fish) => (
        <Entity pos={[fish.x, fish.y]}>
          <PlayerIcon dir={fish.vx > 0}>{fish.icon}</PlayerIcon>
        </Entity>
      ))}
      <div>
        <div>fps: {frameRate.current.toFixed(0)}</div>
        <div>x: {x.toFixed(0)}</div>
        <div>y: {y.toFixed(0)}</div>
        <div>vx: {vx.toFixed(0)}</div>
        <div>vy: {vy.toFixed(0)}</div>
      </div>
    </World>
  );
}
