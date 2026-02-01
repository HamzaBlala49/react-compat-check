import { readFile, access, writeFile } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import type { PackageJson, DependencyType, PackageManager } from '../types/index.js';

/**
 * Read and parse the project's package.json
 */
export async function readPackageJson(projectPath: string = process.cwd()): Promise<PackageJson> {
  const packageJsonPath = join(projectPath, 'package.json');
  
  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    return JSON.parse(content) as PackageJson;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('No package.json found in the current directory');
    }
    throw new Error(`Failed to read package.json: ${(error as Error).message}`);
  }
}

/**
 * Write updated package.json to disk
 */
export async function writePackageJson(
  packageJson: PackageJson, 
  projectPath: string = process.cwd()
): Promise<void> {
  const packageJsonPath = join(projectPath, 'package.json');
  const content = JSON.stringify(packageJson, null, 2) + '\n';
  await writeFile(packageJsonPath, content, 'utf-8');
}

/**
 * Get dependencies from package.json based on options
 */
export function getDependencies(
  packageJson: PackageJson,
  options: {
    includeDev: boolean;
    includeOptional: boolean;
  }
): Array<{ name: string; version: string; type: DependencyType }> {
  const dependencies: Array<{ name: string; version: string; type: DependencyType }> = [];
  
  // Always include regular dependencies
  if (packageJson.dependencies) {
    for (const [name, version] of Object.entries(packageJson.dependencies)) {
      dependencies.push({ name, version, type: 'dependencies' });
    }
  }
  
  // Include dev dependencies if flag is set
  if (options.includeDev && packageJson.devDependencies) {
    for (const [name, version] of Object.entries(packageJson.devDependencies)) {
      dependencies.push({ name, version, type: 'devDependencies' });
    }
  }
  
  // Include optional dependencies if flag is set
  if (options.includeOptional && packageJson.optionalDependencies) {
    for (const [name, version] of Object.entries(packageJson.optionalDependencies)) {
      dependencies.push({ name, version, type: 'optionalDependencies' });
    }
  }
  
  return dependencies;
}

/**
 * Detect the package manager being used in the project
 */
export async function detectPackageManager(projectPath: string = process.cwd()): Promise<PackageManager> {
  const lockFiles: Array<{ file: string; manager: PackageManager }> = [
    { file: 'pnpm-lock.yaml', manager: 'pnpm' },
    { file: 'yarn.lock', manager: 'yarn' },
    { file: 'package-lock.json', manager: 'npm' },
  ];
  
  for (const { file, manager } of lockFiles) {
    try {
      await access(join(projectPath, file), constants.F_OK);
      return manager;
    } catch {
      // File doesn't exist, continue checking
    }
  }
  
  // Default to npm if no lockfile is found
  return 'npm';
}

/**
 * Get the install command for a package manager
 */
export function getInstallCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case 'yarn':
      return 'yarn install';
    case 'pnpm':
      return 'pnpm install';
    case 'npm':
    default:
      return 'npm install';
  }
}

/**
 * Extract the installed version from a version range
 * This is a simplified extraction - in a real scenario, you'd read from node_modules
 */
export function extractInstalledVersion(versionRange: string): string {
  // Remove common prefixes like ^, ~, >=, etc.
  const cleaned = versionRange.replace(/^[\^~>=<]+/, '');
  // Return the first version-like pattern
  const match = cleaned.match(/\d+\.\d+\.\d+/);
  return match ? match[0] : versionRange;
}
