import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { clamp } from "./util";
import { useKeys } from "./hooks";

const PLAYER_SIZE = 24;

const W = () => window.innerWidth;
const H = () => window.innerHeight;

const World = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  overflow: hidden;
  background-color: #5e89ff;
`;

const Player = styled.div.attrs((p: any) => ({
  style: {
    transform: `translate(${p.pos[0]}px, ${p.pos[1]}px)`,
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
    rotateY(${(p) => (p.direction ? "180deg" : "0")});
`;

export default function App() {
  const [ax, setAx] = useState(0);
  const [ay, setAy] = useState(0);

  const [vx, setVx] = useState(0);
  const [vy, setVy] = useState(0);

  const [x, setXRaw] = useState(W() / 2);
  const [y, setYRaw] = useState(0);

  const setX = (valueOrFunction: number | Function) => {
    setXRaw((prevValue: number) => {
      let value =
        typeof valueOrFunction === "function"
          ? valueOrFunction(prevValue)
          : valueOrFunction;
      return clamp(PLAYER_SIZE / 2, W() - PLAYER_SIZE / 2, value);
    });
  };

  const setY = (valueOrFunction: number | Function) => {
    setYRaw((prevValue: number) => {
      let value =
        typeof valueOrFunction === "function"
          ? valueOrFunction(prevValue)
          : valueOrFunction;
      return clamp(PLAYER_SIZE / 2, H() - PLAYER_SIZE / 2, value);
    });
  };

  const [dir, setDir] = useState(false);

  const lastFrameRef = useRef(0);
  const frameRate = useRef(0);

  const keys = useKeys();
  const playerSpeed = 5;

  useEffect(() => {
    function update(timestamp: number) {
      frameRate.current = 1 / ((timestamp - lastFrameRef.current) / 1000);
      lastFrameRef.current = timestamp;
      for (let key of keys) {
        switch (key) {
          case "ArrowUp":
            setY((y: number) => y - playerSpeed);
            break;

          case "ArrowDown":
            setY((y: number) => y + playerSpeed);
            break;

          case "ArrowLeft":
            setX((x: number) => x - playerSpeed);
            setDir(false);
            break;

          case "ArrowRight":
            setX((x: number) => x + playerSpeed);
            setDir(true);
            break;
        }
      }
    }
    const frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  });

  return (
    <World>
      <Player pos={[x, y]}>
        <PlayerIcon direction={dir}>🦅</PlayerIcon>
      </Player>
      <div>
        <div>{frameRate.current.toFixed(0)}</div>
        <div>{x}</div>
        <div>{y}</div>
      </div>
    </World>
  );
}
