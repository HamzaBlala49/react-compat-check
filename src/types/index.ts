/**
 * Compatibility status for a dependency
 */
export type CompatibilityStatus = 'compatible' | 'incompatible' | 'unknown';

/**
 * Upgrade action for a dependency
 */
export type UpgradeAction = 'nearest-compatible' | 'latest' | 'skip';

/**
 * Fix mode from CLI flag
 */
export type FixMode = 'nearest' | 'latest' | 'none';

/**
 * Package manager type
 */
export type PackageManager = 'npm' | 'yarn' | 'pnpm';

/**
 * Dependency type in package.json
 */
export type DependencyType = 'dependencies' | 'devDependencies' | 'optionalDependencies';

/**
 * CLI options parsed from command line
 */
export interface CLIOptions {
  react?: string;
  includeDev: boolean;
  includeOptional: boolean;
  json: boolean;
  fix?: FixMode;
}

/**
 * Result of analyzing a single dependency
 */
export interface DependencyAnalysis {
  name: string;
  installedVersion: string;
  status: CompatibilityStatus;
  supportedReactRange: string | null;
  nearestCompatibleVersion: string | null;
  latestVersion: string;
  dependencyType: DependencyType;
}

/**
 * Overall analysis result
 */
export interface AnalysisResult {
  targetReactVersion: string;
  dependencies: DependencyAnalysis[];
  hasIncompatible: boolean;
  hasUnknown: boolean;
}

/**
 * Upgrade selection for a single package
 */
export interface UpgradeSelection {
  packageName: string;
  action: UpgradeAction;
  targetVersion: string | null;
}

/**
 * npm registry package metadata
 */
export interface NpmPackageMetadata {
  name: string;
  'dist-tags': {
    latest: string;
    [tag: string]: string;
  };
  versions: {
    [version: string]: NpmVersionMetadata;
  };
}

/**
 * npm registry version metadata
 */
export interface NpmVersionMetadata {
  name: string;
  version: string;
  peerDependencies?: {
    react?: string;
    'react-dom'?: string;
    [key: string]: string | undefined;
  };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Project package.json structure
 */
export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

/**
 * Exit codes for CI support
 */
export enum ExitCode {
  SUCCESS = 0,
  INCOMPATIBLE = 1,
  ERROR = 2,
}
