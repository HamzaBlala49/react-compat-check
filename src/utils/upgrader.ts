import { spawn } from 'child_process';
import chalk from 'chalk';
import {
  readPackageJson,
  writePackageJson,
  detectPackageManager,
  getInstallCommand,
} from './package-parser.js';
import type {
  UpgradeSelection,
  DependencyAnalysis,
  FixMode,
  RequiredUpgrade,
} from '../types/index.js';

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
 * Collect all companion upgrades from selected packages
 * Uses the correct companion list based on whether nearest or latest was selected
 */
export function collectCompanionUpgrades(
  selections: UpgradeSelection[],
  allDeps: DependencyAnalysis[]
): RequiredUpgrade[] {
  const companionUpgrades: RequiredUpgrade[] = [];
  const seen = new Set<string>();

  for (const selection of selections) {
    if (selection.action === 'skip') continue;

    const dep = allDeps.find(d => d.name === selection.packageName);
    if (!dep) continue;

    // Choose the correct companion upgrades based on the selected action
    const upgrades =
      selection.action === 'nearest-compatible'
        ? dep.requiredUpgradesForNearest
        : dep.requiredUpgradesForLatest;

    for (const upgrade of upgrades) {
      if (!seen.has(upgrade.name)) {
        seen.add(upgrade.name);
        companionUpgrades.push(upgrade);
      }
    }
  }

  return companionUpgrades;
}

/**
 * Update package.json with new versions (including companion packages)
 */
export async function updatePackageJson(
  selections: UpgradeSelection[],
  allDeps: DependencyAnalysis[],
  includeCompanions: boolean = true
): Promise<void> {
  const packageJson = await readPackageJson();
  const upgrades = selections.filter(s => s.action !== 'skip' && s.targetVersion);

  // Update main packages
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

  // Update companion packages if requested
  if (includeCompanions) {
    const companionUpgrades = collectCompanionUpgrades(selections, allDeps);

    for (const companion of companionUpgrades) {
      // Find where the companion package is currently located
      if (packageJson.dependencies?.[companion.name]) {
        packageJson.dependencies[companion.name] = companion.requiredVersion;
      } else if (packageJson.devDependencies?.[companion.name]) {
        packageJson.devDependencies[companion.name] = companion.requiredVersion;
      } else if (packageJson.optionalDependencies?.[companion.name]) {
        packageJson.optionalDependencies[companion.name] = companion.requiredVersion;
      }
    }

    if (companionUpgrades.length > 0) {
      console.log(
        chalk.magenta(`  Also updating ${companionUpgrades.length} companion package(s):`)
      );
      for (const companion of companionUpgrades) {
        console.log(
          chalk.dim(
            `    ${companion.name}: ${companion.currentVersion} → ${companion.requiredVersion}`
          )
        );
      }
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

  return new Promise(resolve => {
    const [cmd, ...args] = installCommand.split(' ');
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', code => {
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

    child.on('error', error => {
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
  allDeps: DependencyAnalysis[],
  includeCompanions: boolean = true
): Promise<boolean> {
  const upgrades = selections.filter(s => s.action !== 'skip');

  if (upgrades.length === 0) {
    console.log(chalk.yellow('No upgrades to apply.'));
    return true;
  }

  try {
    await updatePackageJson(selections, allDeps, includeCompanions);
    return await runInstall();
  } catch (error) {
    console.error(chalk.red(`Failed to apply upgrades: ${(error as Error).message}`));
    return false;
  }
}
