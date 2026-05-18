import { execFile } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class OutputSandbox {
  constructor({ outputDir }) {
    if (!outputDir) {
      throw new Error('outputDir is required');
    }

    this.outputDir = path.resolve(outputDir);
    fs.mkdirSync(this.outputDir, { recursive: true });
    this.outputDir = fs.realpathSync(this.outputDir);
  }

  async writeOutput(relPath, content) {
    const targetPath = resolveInside(this.outputDir, relPath, 'outside output directory');
    const parentDir = path.dirname(targetPath);

    await fsp.mkdir(parentDir, { recursive: true });
    const realParentDir = await fsp.realpath(parentDir);
    if (!isInside(this.outputDir, realParentDir)) {
      throw new Error('outside output directory');
    }

    await assertWritableTargetInsideOutput(this.outputDir, targetPath);
    await fsp.writeFile(targetPath, content, 'utf8');

    return targetPath;
  }
}

export class PodmanSandbox {
  constructor({
    image,
    timeoutMs = 30_000,
    workspaceDir,
    skillsDir,
    outputDir,
  }) {
    if (!image) {
      throw new Error('image is required');
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error('timeoutMs must be a positive integer');
    }

    this.image = image;
    this.timeoutMs = timeoutMs;
    this.workspaceDir = requireExistingDir(workspaceDir, 'workspaceDir');
    this.skillsDir = requireExistingDir(skillsDir, 'skillsDir');
    this.outputDir = path.resolve(requirePath(outputDir, 'outputDir'));
    fs.mkdirSync(this.outputDir, { recursive: true });
    this.outputDir = fs.realpathSync(this.outputDir);
  }

  buildMounts() {
    return [
      ['-v', `${this.skillsDir}:/mnt/skills:ro`],
      ['-v', `${this.outputDir}:/workspace/output:rw`],
      ['-v', `${this.workspaceDir}:/workspace/context:ro`],
    ].flat();
  }

  async execute(scriptPath, args = []) {
    const realScriptPath = requireExistingFile(scriptPath, 'scriptPath');

    if (!isInside(this.skillsDir, realScriptPath)) {
      throw new Error('scriptPath must be inside skillsDir');
    }

    const relativeScriptPath = path.relative(this.skillsDir, realScriptPath);
    const containerScriptPath = path.posix.join(
      '/mnt/skills',
      relativeScriptPath.split(path.sep).join(path.posix.sep),
    );

    return this.runNode([containerScriptPath, ...args.map(String)]);
  }

  async executeCode(code) {
    return this.runNode(['-e', String(code)]);
  }

  async runNode(nodeArgs) {
    const podmanArgs = [
      'run',
      '--rm',
      `--timeout=${Math.ceil(this.timeoutMs / 1000)}`,
      ...this.buildMounts(),
      this.image,
      'node',
      ...nodeArgs,
    ];

    try {
      const { stdout } = await execFileAsync('podman', podmanArgs, {
        timeout: this.timeoutMs,
        maxBuffer: 1024 * 1024,
      });

      return stdout.trim();
    } catch (error) {
      if (error.killed || error.signal === 'SIGTERM' || error.code === 'ETIMEDOUT') {
        throw new Error(`沙箱执行超时：${this.timeoutMs}ms`);
      }

      const detail = String(error.stderr || error.stdout || error.message || '').trim();
      throw new Error(detail ? `沙箱执行失败：${detail}` : '沙箱执行失败');
    }
  }
}

function requirePath(value, name) {
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function requireExistingDir(dirPath, name) {
  let realPath;
  try {
    realPath = fs.realpathSync(requirePath(dirPath, name));
  } catch (error) {
    throw new Error(`${name} must exist`, { cause: error });
  }

  const stat = fs.statSync(realPath);

  if (!stat.isDirectory()) {
    throw new Error(`${name} must be a directory`);
  }

  return realPath;
}

function requireExistingFile(filePath, name) {
  let realPath;
  try {
    realPath = fs.realpathSync(requirePath(filePath, name));
  } catch (error) {
    throw new Error(`${name} must exist`, { cause: error });
  }

  const stat = fs.statSync(realPath);

  if (!stat.isFile()) {
    throw new Error(`${name} must be a file`);
  }

  return realPath;
}

function resolveInside(parentDir, relPath, message) {
  const targetPath = path.resolve(parentDir, relPath);

  if (!isInside(parentDir, targetPath)) {
    throw new Error(message);
  }

  return targetPath;
}

async function assertWritableTargetInsideOutput(outputDir, targetPath) {
  let stat;

  try {
    stat = await fsp.lstat(targetPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return;
    }

    throw error;
  }

  if (stat.isSymbolicLink()) {
    throw new Error('symlink target outside output directory');
  }

  const realTargetPath = await fsp.realpath(targetPath);
  if (!isInside(outputDir, realTargetPath)) {
    throw new Error('outside output directory');
  }
}

function isInside(parentDir, childPath) {
  const relative = path.relative(path.resolve(parentDir), path.resolve(childPath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
