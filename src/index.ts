#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { 
  resolveReactVersion,
  analyzeProject,
  displayTable,
  outputJson,
  displayError,
  displayInfo,
  displaySuccess,
  promptReactVersion,
  promptUpgradeActions,
  confirmUpgrade,
  applyFixMode,
  applyUpgrades,
} from './utils/index.js';
import type { CLIOptions, FixMode, ExitCode } from './types/index.js';

const program = new Command();

program
  .name('react-compat-check')
  .description('Check React dependency compatibility for your project')
  .version('1.0.0')
  .option('--react <version>', 'Target React version (e.g., 18, 18.2.0, 19)')
  .option('--include-dev', 'Include devDependencies in analysis', false)
  .option('--include-optional', 'Include optionalDependencies in analysis', false)
  .option('--json', 'Output results as JSON', false)
  .option('--fix <mode>', 'Auto-fix mode: nearest, latest, or none')
  .action(async (opts) => {
    const options: CLIOptions = {
      react: opts.react,
      includeDev: opts.includeDev,
      includeOptional: opts.includeOptional,
      json: opts.json,
      fix: opts.fix as FixMode | undefined,
    };
    
    try {
      await run(options);
    } catch (error) {
      if (!options.json) {
        displayError((error as Error).message);
      } else {
        console.log(JSON.stringify({ error: (error as Error).message }));
      }
      process.exit(2 as ExitCode);
    }
  });

async function run(options: CLIOptions): Promise<void> {
  // Determine target React version
  let targetReactVersion: string;
  
  if (options.react) {
    if (!options.json) {
      displayInfo(`Resolving React version: ${options.react}`);
    }
    targetReactVersion = await resolveReactVersion(options.react);
    if (!options.json) {
      displayInfo(`Using React version: ${targetReactVersion}`);
    }
  } else {
    if (options.json) {
      throw new Error('--react <version> is required when using --json');
    }
    console.log();
    console.log(chalk.bold('React Upgrade Compatibility Checker'));
    console.log(chalk.dim('Analyze your dependencies for React version compatibility'));
    console.log();
    targetReactVersion = await promptReactVersion();
  }
  
  // Analyze project
  if (!options.json) {
    console.log();
    displayInfo('Analyzing dependencies...');
  }
  
  const result = await analyzeProject(targetReactVersion, {
    includeDev: options.includeDev,
    includeOptional: options.includeOptional,
  });
  
  // Output results
  if (options.json) {
    outputJson(result);
  } else {
    displayTable(result);
  }
  
  // Handle incompatible packages
  if (result.hasIncompatible) {
    const incompatibleDeps = result.dependencies.filter(d => d.status === 'incompatible');
    
    // Determine upgrade selections
    let selections;
    
    if (options.fix) {
      // Non-interactive mode
      selections = applyFixMode(incompatibleDeps, options.fix);
      
      if (options.fix !== 'none' && !options.json) {
        const upgrades = selections.filter(s => s.action !== 'skip');
        if (upgrades.length > 0) {
          console.log(chalk.bold('Auto-fixing with mode:', options.fix));
          for (const upgrade of upgrades) {
            console.log(`  ${chalk.cyan(upgrade.packageName)} → ${chalk.green(upgrade.targetVersion)}`);
          }
          
          const success = await applyUpgrades(selections, result.dependencies, true);
          if (!success) {
            process.exit(2 as ExitCode);
          }
        }
      }
    } else if (!options.json) {
      // Interactive mode
      selections = await promptUpgradeActions(incompatibleDeps);
      
      const hasUpgrades = selections.some(s => s.action !== 'skip');
      if (hasUpgrades) {
        const confirmed = await confirmUpgrade(selections, result.dependencies);
        
        if (confirmed) {
          const success = await applyUpgrades(selections, result.dependencies, true);
          if (success) {
            displaySuccess('Dependencies upgraded successfully!');
          } else {
            process.exit(2 as ExitCode);
          }
        } else {
          displayInfo('Upgrade cancelled.');
        }
      }
    }
    
    // Exit with code 1 if there are still incompatible packages
    // (only if we didn't fix them or if fix mode is 'none')
    if (options.fix === 'none' || !options.fix) {
      process.exit(1 as ExitCode);
    }
  } else {
    if (!options.json) {
      displaySuccess('All dependencies are compatible with React ' + targetReactVersion);
    }
    process.exit(0 as ExitCode);
  }
}

program.parse();
