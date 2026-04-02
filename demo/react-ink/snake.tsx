import React, {useState, useEffect, useRef} from 'react';
import {render, Box, Text, useInput, useApp} from 'ink';

const W = 20, H = 10;
type Pos = [number, number];

const randPos = (): Pos => [
  Math.floor(Math.random() * W),
  Math.floor(Math.random() * H),
];
const eq = (a: Pos, b: Pos) => a[0] === b[0] && a[1] === b[1];

const Snake = () => {
  const {exit} = useApp();
  const dir = useRef<Pos>([1, 0]);
  const [state, setState] = useState({
    snake: [[10, 5]] as Pos[],
    food: [15, 3] as Pos,
    score: 0,
    dead: false,
  });

  useInput((_, key) => {
    if (state.dead) {
      exit();
      return;
    }
    const [dx, dy] = dir.current;
    if (key.upArrow && dy !== 1) dir.current = [0, -1];
    if (key.downArrow && dy !== -1) dir.current = [0, 1];
    if (key.leftArrow && dx !== 1) dir.current = [-1, 0];
    if (key.rightArrow && dx !== -1) dir.current = [1, 0];
    if (key.escape) exit();
  });

  useEffect(() => {
    if (state.dead) return;
    const id = setInterval(() => {
      setState(prev => {
        const [dx, dy] = dir.current;
        const head: Pos = [prev.snake[0]![0] + dx, prev.snake[0]![1] + dy];

        if (
          head[0] < 0 || head[0] >= W || head[1] < 0 || head[1] >= H ||
          prev.snake.some(s => eq(s, head))
        ) {
          return {...prev, dead: true};
        }

        const ate = eq(head, prev.food);
        return {
          snake: [head, ...prev.snake.slice(0, ate ? prev.snake.length : -1)],
          food: ate ? randPos() : prev.food,
          score: prev.score + (ate ? 1 : 0),
          dead: false,
        };
      });
    }, 150);
    return () => clearInterval(id);
  }, [state.dead]);

  const {snake, food, score, dead} = state;

  const grid = Array.from({length: H}, (_, y) =>
    Array.from({length: W}, (_, x) => {
      if (eq(snake[0]!, [x, y])) return '🟢';
      if (snake.some(s => eq(s, [x, y]))) return '🟩';
      if (eq(food, [x, y])) return '🍎';
      return '⬛';
    }).join(''),
  );

  return (
    <Box flexDirection="column">
      <Box gap={2}>
        <Text bold color="green">🐍 Snake</Text>
        <Text color="yellow">Score: {score}</Text>
      </Box>
      {grid.map((row, i) => (
        <Text key={i}>{row}</Text>
      ))}
      {dead ? (
        <Text color="red" bold>Game Over! 按任意键退出</Text>
      ) : (
        <Text color="gray">方向键移动 · ESC 退出</Text>
      )}
    </Box>
  );
};

render(<Snake />);
