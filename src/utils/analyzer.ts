import { readPackageJson, getDependencies } from './package-parser.js';
import { analyzeDependency, isReactRelatedPackage } from './compatibility.js';
import type { AnalysisResult, DependencyAnalysis, CLIOptions } from '../types/index.js';

/**
 * Analyze all dependencies in a project for React compatibility
 */
export async function analyzeProject(
  targetReactVersion: string,
  options: Pick<CLIOptions, 'includeDev' | 'includeOptional'>
): Promise<AnalysisResult> {
  const packageJson = await readPackageJson();
  
  const dependencies = getDependencies(packageJson, {
    includeDev: options.includeDev,
    includeOptional: options.includeOptional,
  });
  
  // Build a map of all project dependencies for companion upgrade analysis
  const projectDependencies: Record<string, string> = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {}),
    ...(packageJson.optionalDependencies || {}),
  };
  
  // Skip react and react-dom themselves
  const filteredDeps = dependencies.filter(dep => 
    dep.name !== 'react' && dep.name !== 'react-dom'
  );
  
  // Analyze all dependencies in parallel with concurrency limit
  const analysisPromises = filteredDeps.map(dep =>
    analyzeDependency(dep.name, dep.version, targetReactVersion, dep.type, projectDependencies)
  );
  
  const results = await Promise.all(analysisPromises);
  
  // Filter to only include React-related packages
  const reactRelatedResults = results.filter(isReactRelatedPackage);
  
  const hasIncompatible = reactRelatedResults.some(r => r.status === 'incompatible');
  const hasUnknown = reactRelatedResults.some(r => r.status === 'unknown');
  
  return {
    targetReactVersion,
    dependencies: reactRelatedResults,
    hasIncompatible,
    hasUnknown,
  };
}

/**
 * Group analysis results by status
 */
export function groupByStatus(results: DependencyAnalysis[]): {
  compatible: DependencyAnalysis[];
  incompatible: DependencyAnalysis[];
  unknown: DependencyAnalysis[];
} {
  return {
    compatible: results.filter(r => r.status === 'compatible'),
    incompatible: results.filter(r => r.status === 'incompatible'),
    unknown: results.filter(r => r.status === 'unknown'),
  };
}

/**
 * Get a summary of the analysis
 */
export function getAnalysisSummary(result: AnalysisResult): string {
  const grouped = groupByStatus(result.dependencies);
  
  const lines = [
    `Target React Version: ${result.targetReactVersion}`,
    `Total packages analyzed: ${result.dependencies.length}`,
    `Compatible: ${grouped.compatible.length}`,
    `Incompatible: ${grouped.incompatible.length}`,
    `Unknown: ${grouped.unknown.length}`,
  ];
  
  return lines.join('\n');
}
