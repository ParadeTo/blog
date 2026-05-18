import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
  buildBootstrapPrompt,
  loadSkillContent,
  loadSkillRegistry,
} from '../src/agent/skill-loader.js';
import { OutputSandbox, PodmanSandbox } from '../src/agent/sandbox.js';

const demoWorkspaceDir = path.resolve('workspace/demo-agent');
const taskAuditPath = path.join(demoWorkspaceDir, 'output/task-audit.jsonl');

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

  test('task audit default path is stable across current working directories', async () => {
    const originalCwd = process.cwd();
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'task-audit-cwd-'));
    await fs.rm(taskAuditPath, { force: true });

    try {
      process.chdir(tempRoot);
      const moduleUrl = pathToFileURL(
        path.join(demoWorkspaceDir, 'hooks/task-audit.js'),
      );
      const taskAudit = await import(`${moduleUrl.href}?case=${Date.now()}`);
      process.chdir(originalCwd);

      taskAudit.writeAuditEntry({
        eventType: 'task_complete',
        sessionId: 'stable-session',
        metadata: { rawOutput: 'stable output' },
      });

      await expect(fs.readFile(taskAuditPath, 'utf8')).resolves.toContain('stable-session');
      await expect(
        fs.access(path.join(tempRoot, 'workspace/demo-agent/output/task-audit.jsonl')),
      ).rejects.toThrow();
    } finally {
      process.chdir(originalCwd);
      await fs.rm(taskAuditPath, { force: true });
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
});

describe('skill-loader containment', () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-loader-'));
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  test('loadSkillContent rejects registry paths outside skillsDir', async () => {
    const skillsDir = path.join(tempRoot, 'skills');
    const outsideFile = path.join(tempRoot, 'outside.md');
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.writeFile(outsideFile, 'outside', 'utf8');

    await expect(
      loadSkillContent(skillsDir, {
        escape: {
          name: 'escape',
          path: '../outside.md',
          description: '',
        },
      }, 'escape'),
    ).rejects.toThrow(/inside directory/i);
  });

  test('loadSkillContent rejects symlink skill files that point outside skillsDir', async () => {
    const skillsDir = path.join(tempRoot, 'skills');
    const outsideFile = path.join(tempRoot, 'outside-skill.md');
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.writeFile(outsideFile, 'outside skill', 'utf8');
    await fs.symlink(outsideFile, path.join(skillsDir, 'linked-skill.md'));

    await expect(
      loadSkillContent(skillsDir, {
        linked: {
          name: 'linked',
          path: 'linked-skill.md',
          description: '',
        },
      }, 'linked'),
    ).rejects.toThrow(/inside directory/i);
  });
});

describe('PodmanSandbox validation', () => {
  let tempRoot;
  let workspaceDir;
  let skillsDir;
  let outputDir;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'podman-sandbox-'));
    workspaceDir = path.join(tempRoot, 'workspace');
    skillsDir = path.join(tempRoot, 'skills');
    outputDir = path.join(tempRoot, 'output');
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.mkdir(skillsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  test('constructor rejects missing required directories', () => {
    expect(() =>
      new PodmanSandbox({
        image: 'demo-image',
        workspaceDir: path.join(tempRoot, 'missing-workspace'),
        skillsDir,
        outputDir,
      }),
    ).toThrow(/workspaceDir must exist/i);

    expect(() =>
      new PodmanSandbox({
        image: 'demo-image',
        workspaceDir,
        skillsDir: path.join(tempRoot, 'missing-skills'),
        outputDir,
      }),
    ).toThrow(/skillsDir must exist/i);
  });

  test('execute rejects scripts outside skillsDir before invoking Podman', async () => {
    const outsideScript = path.join(tempRoot, 'outside.js');
    await fs.writeFile(outsideScript, 'console.log("outside");', 'utf8');
    const sandbox = new PodmanSandbox({
      image: 'demo-image',
      workspaceDir,
      skillsDir,
      outputDir,
    });

    await expect(sandbox.execute(outsideScript)).rejects.toThrow(/inside skillsDir/i);
  });

  test('execute rejects symlink scripts inside skillsDir that point outside', async () => {
    const outsideScript = path.join(tempRoot, 'outside-linked.js');
    await fs.writeFile(outsideScript, 'console.log("outside");', 'utf8');
    await fs.symlink(outsideScript, path.join(skillsDir, 'linked.js'));
    const sandbox = new PodmanSandbox({
      image: 'demo-image',
      workspaceDir,
      skillsDir,
      outputDir,
    });

    await expect(sandbox.execute(path.join(skillsDir, 'linked.js'))).rejects.toThrow(
      /inside skillsDir/i,
    );
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
