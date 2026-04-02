import React, {useState} from 'react';
import {render, Box, Text, useInput, useApp} from 'ink';

const OPTIONS = [
  {label: 'TypeScript', desc: '类型检查', value: 'ts'},
  {label: 'ESLint', desc: '代码规范', value: 'eslint'},
  {label: 'Prettier', desc: '格式化', value: 'prettier'},
  {label: 'Vitest', desc: '单元测试', value: 'vitest'},
  {label: 'Husky', desc: 'Git hooks', value: 'husky'},
];

const MultiSelect = () => {
  const {exit} = useApp();
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState(new Set<string>());
  const [done, setDone] = useState(false);

  useInput((input, key) => {
    if (done) {
      exit();
      return;
    }
    if (key.upArrow) setCursor(i => (i - 1 + OPTIONS.length) % OPTIONS.length);
    if (key.downArrow) setCursor(i => (i + 1) % OPTIONS.length);
    if (input === ' ') {
      setSelected(prev => {
        const next = new Set(prev);
        const val = OPTIONS[cursor]!.value;
        next.has(val) ? next.delete(val) : next.add(val);
        return next;
      });
    }
    if (input === 'a') {
      setSelected(prev =>
        prev.size === OPTIONS.length
          ? new Set()
          : new Set(OPTIONS.map(o => o.value)),
      );
    }
    if (key.return) setDone(true);
    if (key.escape) exit();
  });

  if (done) {
    const items = OPTIONS.filter(o => selected.has(o.value));
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text>
          <Text color="green" bold>✔</Text>
          <Text bold> 已选择 </Text>
          <Text color="cyan">{items.map(o => o.label).join(', ') || '无'}</Text>
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        paddingX={2}
        paddingY={1}>
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            ? 选择要安装的工具
          </Text>
          <Text color="gray">
            {' '}
            ({selected.size}/{OPTIONS.length})
          </Text>
        </Box>

        {OPTIONS.map((opt, i) => {
          const active = i === cursor;
          const checked = selected.has(opt.value);
          return (
            <Box key={opt.value} gap={1}>
              <Text color={active ? 'cyan' : 'gray'}>{active ? '❯' : ' '}</Text>
              <Text color={checked ? 'green' : 'gray'}>
                {checked ? '◼' : '◻'}
              </Text>
              <Text color={active ? 'white' : checked ? 'green' : 'gray'} bold={active || checked}>
                {opt.label}
              </Text>
              <Text color={active ? 'gray' : 'gray'} dimColor>
                {opt.desc}
              </Text>
            </Box>
          );
        })}

        <Box marginTop={1}>
          <Text color="gray" dimColor>
            ↑↓ 移动 · 空格 选中 · a 全选 · Enter 确认
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

render(<MultiSelect />);
