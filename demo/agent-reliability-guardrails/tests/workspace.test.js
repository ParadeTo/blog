import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
  buildBootstrapPrompt,
  loadSkillContent,
  loadSkillRegistry,
} from '../src/agent/skill-loader.js';
import { OutputSandbox } from '../src/agent/sandbox.js';

const demoWorkspaceDir = path.resolve('workspace/demo-agent');

describe('demo agent workspace', () => {
  test('buildBootstrapPrompt includes workspace sections and observability memory', async () => {
    const prompt = await buildBootstrapPrompt(demoWorkspaceDir);

    expect(prompt).toContain('## soul.md');
    expect(prompt).toContain('## memory.md');
    expect(prompt).toContain('Langfuse');
  });

  test('loads sop_design from workspace skill registry and reads its content', async () => {
    const skillsDir = path.join(demoWorkspaceDir, 'skills');
    const registry = await loadSkillRegistry(skillsDir);
    const content = await loadSkillContent(skillsDir, registry, 'sop_design');

    expect(registry.sop_design).toMatchObject({
      name: 'sop_design',
      path: 'sop-design/SKILL.md',
    });
    expect(content).toContain('写设计文档');
  });
});

describe('OutputSandbox', () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'output-sandbox-'));
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  test('writes only under the configured output directory', async () => {
    const outputDir = path.join(tempRoot, 'output');
    const sandbox = new OutputSandbox({ outputDir });

    const writtenPath = await sandbox.writeOutput('design_doc.md', '# ok');

    await expect(fs.readFile(writtenPath, 'utf8')).resolves.toBe('# ok');
    expect(path.basename(writtenPath)).toBe('design_doc.md');
    await expect(sandbox.writeOutput('../escape.md', 'no')).rejects.toThrow(
      /outside output directory/i,
    );
  });

  test('rejects an existing symlink target inside outputDir that points outside', async () => {
    const outputDir = path.join(tempRoot, 'output');
    const outsideDir = path.join(tempRoot, 'outside');
    const outsideFile = path.join(outsideDir, 'escape.txt');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(outsideDir, { recursive: true });
    await fs.writeFile(outsideFile, 'before', 'utf8');
    await fs.symlink(outsideFile, path.join(outputDir, 'escape.txt'));
    const sandbox = new OutputSandbox({ outputDir });

    await expect(sandbox.writeOutput('escape.txt', 'after')).rejects.toThrow(
      /outside output directory|symlink/i,
    );
    await expect(fs.readFile(outsideFile, 'utf8')).resolves.toBe('before');
  });

  test('rejects writes through a symlink parent directory', async () => {
    const outputDir = path.join(tempRoot, 'output');
    const outsideDir = path.join(tempRoot, 'outside-dir');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(outsideDir, { recursive: true });
    await fs.symlink(outsideDir, path.join(outputDir, 'linkdir'));
    const sandbox = new OutputSandbox({ outputDir });

    await expect(sandbox.writeOutput('linkdir/file.md', '# nope')).rejects.toThrow(
      /outside output directory|symlink/i,
    );
    await expect(fs.readdir(outsideDir)).resolves.toEqual([]);
  });
});
