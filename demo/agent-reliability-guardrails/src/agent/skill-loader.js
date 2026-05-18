import fs from 'node:fs/promises';
import path from 'node:path';

import YAML from 'yaml';

const BOOTSTRAP_FILES = ['soul.md', 'user.md', 'agent.md', 'memory.md'];

export async function buildBootstrapPrompt(workspaceDir) {
  const sections = [];

  for (const filename of BOOTSTRAP_FILES) {
    const filePath = await resolveExistingInside(workspaceDir, filename);
    const content = await fs.readFile(filePath, 'utf8');
    sections.push(`## ${filename}\n\n${content.trim()}`);
  }

  return sections.join('\n\n---\n\n');
}

export async function loadSkillRegistry(skillsDir) {
  const registryPath = await resolveExistingInside(skillsDir, 'load-skills.yaml');
  const config = YAML.parse(await fs.readFile(registryPath, 'utf8')) ?? {};
  const skills = Array.isArray(config.skills) ? config.skills : [];
  const registry = {};

  for (const skill of skills) {
    if (!skill?.name || !skill?.path) {
      throw new Error('skill registry entries require name and path');
    }

    registry[skill.name] = {
      name: skill.name,
      path: skill.path,
      description: skill.description ?? '',
    };
  }

  return registry;
}

export async function loadSkillContent(skillsDir, registry, skillName) {
  const skill = registry?.[skillName];

  if (!skill) {
    throw new Error(`unknown skill: ${skillName}`);
  }

  const skillPath = await resolveExistingInside(skillsDir, skill.path);
  return fs.readFile(skillPath, 'utf8');
}

async function resolveExistingInside(parentDir, childPath) {
  const parentReal = await fs.realpath(parentDir);
  const candidate = path.resolve(parentReal, childPath);
  const candidateReal = await fs.realpath(candidate);

  if (!isInside(parentReal, candidateReal)) {
    throw new Error(`path must stay inside directory: ${childPath}`);
  }

  return candidateReal;
}

function isInside(parentDir, childPath) {
  const relative = path.relative(path.resolve(parentDir), path.resolve(childPath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
