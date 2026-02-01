import inquirer from 'inquirer';
import chalk from 'chalk';
import { getMajorReactVersions, fetchReactVersions } from './registry.js';
import { collectCompanionUpgrades } from './upgrader.js';
import type { DependencyAnalysis, UpgradeAction, UpgradeSelection } from '../types/index.js';

/**
 * Prompt user to select a React version
 */
export async function promptReactVersion(): Promise<string> {
  const majorVersions = await getMajorReactVersions();
  const allVersions = await fetchReactVersions();
  
  // Show major versions first, with option to see all
  const choices = [
    ...majorVersions.slice(0, 5).map(v => ({
      name: `React ${v} (latest in ${v.split('.')[0]}.x)`,
      value: v,
    })),
    new inquirer.Separator(),
    {
      name: 'See all versions...',
      value: '__all__',
    },
  ];
  
  const { version } = await inquirer.prompt<{ version: string }>([
    {
      type: 'list',
      name: 'version',
      message: 'Select target React version:',
      choices,
    },
  ]);
  
  if (version === '__all__') {
    // Show all stable versions
    const stableVersions = allVersions.filter(v => !v.includes('-'));
    
    const { selectedVersion } = await inquirer.prompt<{ selectedVersion: string }>([
      {
        type: 'list',
        name: 'selectedVersion',
        message: 'Select React version:',
        choices: stableVersions.slice(0, 50).map(v => ({
          name: v,
          value: v,
        })),
        pageSize: 15,
      },
    ]);
    
    return selectedVersion;
  }
  
  return version;
}

/**
 * Prompt user to select upgrade actions for incompatible packages
 */
export async function promptUpgradeActions(
  incompatibleDeps: DependencyAnalysis[]
): Promise<UpgradeSelection[]> {
  if (incompatibleDeps.length === 0) {
    return [];
  }
  
  console.log();
  console.log(chalk.bold('Choose upgrade actions for incompatible packages:'));
  console.log();
  
  const selections: UpgradeSelection[] = [];
  
  for (const dep of incompatibleDeps) {
    const choices: Array<{ name: string; value: UpgradeAction }> = [];
    
    if (dep.nearestCompatibleVersion) {
      choices.push({
        name: `Upgrade to nearest compatible (${chalk.green(dep.nearestCompatibleVersion)})`,
        value: 'nearest-compatible',
      });
    }
    
    choices.push({
      name: `Upgrade to latest (${chalk.cyan(dep.latestVersion)})`,
      value: 'latest',
    });
    
    choices.push({
      name: 'Skip',
      value: 'skip',
    });
    
    const { action } = await inquirer.prompt<{ action: UpgradeAction }>([
      {
        type: 'list',
        name: 'action',
        message: `${chalk.red(dep.name)} (current: ${dep.installedVersion}, supports: ${dep.supportedReactRange || 'unknown'}):`,
        choices,
      },
    ]);
    
    let targetVersion: string | null = null;
    if (action === 'nearest-compatible') {
      targetVersion = dep.nearestCompatibleVersion;
    } else if (action === 'latest') {
      targetVersion = dep.latestVersion;
    }
    
    selections.push({
      packageName: dep.name,
      action,
      targetVersion,
    });
  }
  
  return selections;
}

/**
 * Prompt user to confirm upgrade
 */
export async function confirmUpgrade(
  selections: UpgradeSelection[],
  allDeps: DependencyAnalysis[]
): Promise<boolean> {
  const upgrades = selections.filter(s => s.action !== 'skip');
  
  if (upgrades.length === 0) {
    return false;
  }
  
  // Collect companion upgrades
  const companionUpgrades = collectCompanionUpgrades(selections, allDeps);
  
  console.log();
  console.log(chalk.bold('The following packages will be upgraded:'));
  console.log();
  console.log(chalk.dim('  Main packages:'));
  for (const upgrade of upgrades) {
    console.log(`    ${chalk.cyan(upgrade.packageName)} → ${chalk.green(upgrade.targetVersion)}`);
  }
  
  if (companionUpgrades.length > 0) {
    console.log();
    console.log(chalk.dim('  Companion packages:'));
    for (const companion of companionUpgrades) {
      console.log(`    ${chalk.magenta(companion.name)} ${chalk.dim(companion.currentVersion + ' →')} ${chalk.yellow(companion.requiredVersion)}`);
    }
  }
  
  console.log();
  
  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Proceed with upgrade?',
      default: true,
    },
  ]);
  
  return confirmed;
}
