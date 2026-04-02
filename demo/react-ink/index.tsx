import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';

type Task = { label: string; progress: number; color: string };

const SPINNERS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const Bar = ({ value, color }: { value: number; color: string }) => {
  const filled = Math.round(value / 5);
  return (
    <Text>
      <Text color={color}>{'█'.repeat(filled)}</Text>
      <Text color="gray">{'░'.repeat(20 - filled)}</Text>
      <Text color="white"> {String(value).padStart(3)}%</Text>
    </Text>
  );
};

const Pipeline = () => {
  const { exit } = useApp();
  const [tick, setTick] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([
    { label: 'Install deps ', progress: 0, color: 'cyan' },
    { label: 'Type check   ', progress: 0, color: 'blue' },
    { label: 'Run tests    ', progress: 0, color: 'yellow' },
    { label: 'Build & Ship ', progress: 0, color: 'green' },
  ]);

  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => t + 1);
      setTasks(prev =>
        prev.map((t, i) => ({
          ...t,
          progress: Math.min(100, t.progress + [5, 3, 2, 1][i]),
        }))
      );
    }, 80);
    return () => clearInterval(id);
  }, []);

  useInput((_, key) => {
    if (key.escape) exit();
  });

  const done = tasks.every(t => t.progress === 100);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
      <Box marginBottom={1} gap={1}>
        <Text bold color="cyan">▶ Build Pipeline</Text>
        <Text color="gray">{done ? '✓ done' : SPINNERS[tick % 10]}</Text>
      </Box>
      {tasks.map(t => (
        <Box key={t.label} gap={1}>
          <Text color={t.progress === 100 ? 'green' : 'white'}>
            {t.progress === 100 ? '✓' : '·'} {t.label}
          </Text>
          <Bar value={t.progress} color={t.color} />
        </Box>
      ))}
      {done && (
        <Box marginTop={1}>
          <Text dimColor>按 ESC 退出</Text>
        </Box>
      )}
    </Box>
  );
};

render(<Pipeline />);
