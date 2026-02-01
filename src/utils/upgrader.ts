import { spawn } from 'child_process';
import chalk from 'chalk';
import { 
  readPackageJson, 
  writePackageJson, 
  detectPackageManager, 
  getInstallCommand 
} from './package-parser.js';
import type { UpgradeSelection, DependencyAnalysis, FixMode } from '../types/index.js';

/**
 * Apply automatic fix mode to all incompatible dependencies
 */
export function applyFixMode(
  incompatibleDeps: DependencyAnalysis[],
  fixMode: FixMode
): UpgradeSelection[] {
  if (fixMode === 'none') {
    return incompatibleDeps.map(dep => ({
      packageName: dep.name,
      action: 'skip',
      targetVersion: null,
    }));
  }
  
  return incompatibleDeps.map(dep => {
    if (fixMode === 'nearest' && dep.nearestCompatibleVersion) {
      return {
        packageName: dep.name,
        action: 'nearest-compatible' as const,
        targetVersion: dep.nearestCompatibleVersion,
      };
    }
    
    if (fixMode === 'latest') {
      return {
        packageName: dep.name,
        action: 'latest' as const,
        targetVersion: dep.latestVersion,
      };
    }
    
    // Default to latest if nearest not available
    return {
      packageName: dep.name,
      action: 'latest' as const,
      targetVersion: dep.latestVersion,
    };
  });
}

/**
 * Update package.json with new versions
 */
export async function updatePackageJson(
  selections: UpgradeSelection[],
  allDeps: DependencyAnalysis[]
): Promise<void> {
  const packageJson = await readPackageJson();
  const upgrades = selections.filter(s => s.action !== 'skip' && s.targetVersion);
  
  for (const upgrade of upgrades) {
    const dep = allDeps.find(d => d.name === upgrade.packageName);
    if (!dep || !upgrade.targetVersion) continue;
    
    const newVersion = `^${upgrade.targetVersion}`;
    
    // Update the correct dependency section
    switch (dep.dependencyType) {
      case 'dependencies':
        if (packageJson.dependencies) {
          packageJson.dependencies[upgrade.packageName] = newVersion;
        }
        break;
      case 'devDependencies':
        if (packageJson.devDependencies) {
          packageJson.devDependencies[upgrade.packageName] = newVersion;
        }
        break;
      case 'optionalDependencies':
        if (packageJson.optionalDependencies) {
          packageJson.optionalDependencies[upgrade.packageName] = newVersion;
        }
        break;
    }
  }
  
  await writePackageJson(packageJson);
  console.log(chalk.green('✓ Updated package.json'));
}

/**
 * Run the package manager install command
 */
export async function runInstall(): Promise<boolean> {
  const packageManager = await detectPackageManager();
  const installCommand = getInstallCommand(packageManager);
  
  console.log();
  console.log(chalk.blue(`Running: ${installCommand}`));
  console.log();
  
  return new Promise((resolve) => {
    const [cmd, ...args] = installCommand.split(' ');
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: true,
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log();
        console.log(chalk.green('✓ Installation complete'));
        resolve(true);
      } else {
        console.log();
        console.log(chalk.red(`✗ Installation failed with code ${code}`));
        resolve(false);
      }
    });
    
    child.on('error', (error) => {
      console.error(chalk.red(`Error running install: ${error.message}`));
      resolve(false);
    });
  });
}

/**
 * Apply upgrades and run install
 */
export async function applyUpgrades(
  selections: UpgradeSelection[],
  allDeps: DependencyAnalysis[]
): Promise<boolean> {
  const upgrades = selections.filter(s => s.action !== 'skip');
  
  if (upgrades.length === 0) {
    console.log(chalk.yellow('No upgrades to apply.'));
    return true;
  }
  
  try {
    await updatePackageJson(selections, allDeps);
    return await runInstall();
  } catch (error) {
    console.error(chalk.red(`Failed to apply upgrades: ${(error as Error).message}`));
    return false;
  }
}
