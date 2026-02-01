import chalk from 'chalk';
import Table from 'cli-table3';
import type { AnalysisResult, CompatibilityStatus } from '../types/index.js';

/**
 * Get the color for a status
 */
function getStatusColor(status: CompatibilityStatus): typeof chalk {
  switch (status) {
    case 'compatible':
      return chalk.green;
    case 'incompatible':
      return chalk.red;
    case 'unknown':
      return chalk.yellow;
  }
}

/**
 * Format status text with color
 */
function formatStatus(status: CompatibilityStatus): string {
  const color = getStatusColor(status);
  const text = status.charAt(0).toUpperCase() + status.slice(1);
  return color(text);
}

/**
 * Format the supported React range
 */
function formatReactRange(range: string | null): string {
  if (range === null) {
    return chalk.dim('N/A');
  }
  return range;
}

/**
 * Format version with color based on context
 */
function formatVersion(version: string | null, status: CompatibilityStatus): string {
  if (version === null) {
    return chalk.dim('-');
  }
  if (status === 'incompatible') {
    return chalk.green(version);
  }
  return version;
}

/**
 * Display analysis results as a table
 */
export function displayTable(result: AnalysisResult): void {
  console.log();
  console.log(
    chalk.bold(`React Compatibility Check for version ${chalk.cyan(result.targetReactVersion)}`)
  );
  console.log();

  if (result.dependencies.length === 0) {
    console.log(chalk.yellow('No React-related dependencies found.'));
    return;
  }

  const table = new Table({
    head: [
      chalk.bold('Package'),
      chalk.bold('Installed'),
      chalk.bold('Status'),
      chalk.bold('Supported React'),
      chalk.bold('Nearest Compatible'),
      chalk.bold('Latest'),
    ],
    style: {
      head: [],
      border: [],
    },
  });

  // Sort: incompatible first, then unknown, then compatible
  const sortedDeps = [...result.dependencies].sort((a, b) => {
    const order: Record<CompatibilityStatus, number> = {
      incompatible: 0,
      unknown: 1,
      compatible: 2,
    };
    return order[a.status] - order[b.status];
  });

  for (const dep of sortedDeps) {
    table.push([
      dep.name,
      dep.installedVersion,
      formatStatus(dep.status),
      formatReactRange(dep.supportedReactRange),
      formatVersion(dep.nearestCompatibleVersion, dep.status),
      dep.latestVersion,
    ]);
  }

  console.log(table.toString());
  console.log();

  // Display required companion upgrades (show for nearest version as default preview)
  const depsWithRequiredUpgrades = result.dependencies.filter(
    d => d.requiredUpgradesForNearest.length > 0 || d.requiredUpgradesForLatest.length > 0
  );
  if (depsWithRequiredUpgrades.length > 0) {
    console.log(chalk.bold.magenta('📦 Required Companion Upgrades:'));
    console.log(
      chalk.dim('  When upgrading these packages, you also need to upgrade their dependencies:')
    );
    console.log();

    for (const dep of depsWithRequiredUpgrades) {
      // Show nearest compatible upgrades
      if (dep.nearestCompatibleVersion && dep.requiredUpgradesForNearest.length > 0) {
        console.log(
          `  ${chalk.cyan(dep.name)} → ${chalk.green(dep.nearestCompatibleVersion)} ${chalk.dim('(nearest)')}`
        );
        for (const upgrade of dep.requiredUpgradesForNearest) {
          console.log(
            `    ${chalk.yellow('└─ ↑ ')} ${chalk.bold(upgrade.name)} ${chalk.dim(upgrade.currentVersion + ' →')} ${chalk.yellow(upgrade.requiredVersion)}`
          );
        }
      }

      // Show latest upgrades if different
      if (dep.requiredUpgradesForLatest.length > 0) {
        const latestDifferent = dep.nearestCompatibleVersion !== dep.latestVersion;
        if (latestDifferent) {
          console.log(
            `  ${chalk.cyan(dep.name)} → ${chalk.blue(dep.latestVersion)} ${chalk.dim('(latest)')}`
          );
          for (const upgrade of dep.requiredUpgradesForLatest) {
            console.log(
              `    ${chalk.yellow('└─ ↑ ')} ${chalk.bold(upgrade.name)} ${chalk.dim(upgrade.currentVersion + ' →')} ${chalk.yellow(upgrade.requiredVersion)}`
            );
          }
        }
      }
      console.log();
    }
  }

  // Summary
  const compatible = result.dependencies.filter(d => d.status === 'compatible').length;
  const incompatible = result.dependencies.filter(d => d.status === 'incompatible').length;
  const withRequiredUpgrades = depsWithRequiredUpgrades.length;

  console.log(chalk.bold('Summary:'));
  console.log(`  ${chalk.green('✓')} Compatible: ${compatible}`);
  console.log(`  ${chalk.red('✗')} Incompatible: ${incompatible}`);
  if (withRequiredUpgrades > 0) {
    console.log(`  ${chalk.magenta('📦')} With companion upgrades needed: ${withRequiredUpgrades}`);
  }
  console.log();
}

/**
 * Output analysis results as JSON
 */
export function outputJson(result: AnalysisResult): void {
  const depsWithRequiredUpgrades = result.dependencies.filter(
    d => d.requiredUpgradesForNearest.length > 0 || d.requiredUpgradesForLatest.length > 0
  );

  const output = {
    targetReactVersion: result.targetReactVersion,
    summary: {
      total: result.dependencies.length,
      compatible: result.dependencies.filter(d => d.status === 'compatible').length,
      incompatible: result.dependencies.filter(d => d.status === 'incompatible').length,
      withRequiredUpgrades: depsWithRequiredUpgrades.length,
    },
    hasIncompatible: result.hasIncompatible,
    hasRequiredUpgrades: depsWithRequiredUpgrades.length > 0,
    dependencies: result.dependencies.map(dep => ({
      name: dep.name,
      installedVersion: dep.installedVersion,
      status: dep.status,
      supportedReactRange: dep.supportedReactRange,
      nearestCompatibleVersion: dep.nearestCompatibleVersion,
      latestVersion: dep.latestVersion,
      dependencyType: dep.dependencyType,
      requiredUpgradesForNearest: dep.requiredUpgradesForNearest.map(upgrade => ({
        name: upgrade.name,
        currentVersion: upgrade.currentVersion,
        requiredVersion: upgrade.requiredVersion,
      })),
      requiredUpgradesForLatest: dep.requiredUpgradesForLatest.map(upgrade => ({
        name: upgrade.name,
        currentVersion: upgrade.currentVersion,
        requiredVersion: upgrade.requiredVersion,
      })),
    })),
  };

  console.log(JSON.stringify(output, null, 2));
}

/**
 * Display an error message
 */
export function displayError(message: string): void {
  console.error(chalk.red(`Error: ${message}`));
}

/**
 * Display a success message
 */
export function displaySuccess(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

/**
 * Display a warning message
 */
export function displayWarning(message: string): void {
  console.log(chalk.yellow(`⚠ ${message}`));
}

/**
 * Display an info message
 */
export function displayInfo(message: string): void {
  console.log(chalk.blue(`ℹ ${message}`));
}
