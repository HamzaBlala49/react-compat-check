import * as semver from 'semver';
import { fetchPackageMetadata } from './registry.js';
import type { 
  CompatibilityStatus, 
  DependencyAnalysis, 
  DependencyType,
  NpmVersionMetadata,
  RequiredUpgrade
} from '../types/index.js';

/**
 * Check if a React version satisfies a peer dependency range
 */
export function checkReactCompatibility(
  reactVersion: string,
  peerDependencyRange: string | undefined
): CompatibilityStatus {
  if (!peerDependencyRange) {
    return 'unknown';
  }
  
  try {
    // Normalize the range using semver's built-in validation
    const normalizedRange = normalizePeerDepRange(peerDependencyRange);
    
    if (!normalizedRange) {
      return 'unknown';
    }
    
    // Coerce the react version to ensure it's valid
    const coercedVersion = semver.coerce(reactVersion);
    if (!coercedVersion) {
      return 'unknown';
    }
    
    if (semver.satisfies(coercedVersion.version, normalizedRange)) {
      return 'compatible';
    }
    return 'incompatible';
  } catch {
    // If semver can't parse the range, treat as unknown
    return 'unknown';
  }
}

/**
 * Normalize peer dependency ranges that might have unusual formats
 */
function normalizePeerDepRange(range: string): string | null {
  // First, try semver's built-in range validation
  const validRange = semver.validRange(range);
  if (validRange) {
    return validRange;
  }
  
  // If that fails, try manual normalization
  let normalized = range.trim();
  
  // Handle "||" with spaces
  normalized = normalized.replace(/\s*\|\|\s*/g, ' || ');
  
  // Handle versions missing patch: 16.8 -> 16.8.0
  normalized = normalized.replace(/(\d+\.\d+)(?!\.\d)(?!\s*-)/g, '$1.0');
  
  // Handle versions missing minor and patch: 16 -> 16.0.0
  normalized = normalized.replace(/(?<![.\d])(\d+)(?!\.\d)(?!\s*-)/g, '$1.0.0');
  
  // Try validating again after normalization
  return semver.validRange(normalized);
}

/**
 * Get the React peer dependency range from a specific version
 */
function getReactPeerDep(versionMeta: NpmVersionMetadata): string | undefined {
  return versionMeta.peerDependencies?.react;
}

/**
 * Find the nearest compatible version (lowest version newer than installed that supports target React)
 */
export async function findNearestCompatibleVersion(
  packageName: string,
  installedVersion: string,
  targetReactVersion: string
): Promise<string | null> {
  const metadata = await fetchPackageMetadata(packageName);
  const versions = Object.keys(metadata.versions);
  
  // Filter versions that are:
  // 1. Greater than installed version
  // 2. Compatible with target React version
  // 3. Not pre-release
  const compatibleVersions = versions.filter(version => {
    // Skip pre-release versions
    if (semver.prerelease(version)) return false;
    
    // Must be greater than installed
    if (!semver.gt(version, installedVersion)) return false;
    
    const versionMeta = metadata.versions[version];
    const reactPeerDep = getReactPeerDep(versionMeta);
    
    // Must have a React peer dependency and be compatible
    if (!reactPeerDep) return false;
    
    return checkReactCompatibility(targetReactVersion, reactPeerDep) === 'compatible';
  });
  
  if (compatibleVersions.length === 0) {
    return null;
  }
  
  // Sort and return the lowest (nearest) compatible version
  compatibleVersions.sort((a, b) => semver.compare(a, b));
  return compatibleVersions[0];
}

/**
 * Find the latest compatible version
 */
export async function findLatestCompatibleVersion(
  packageName: string,
  targetReactVersion: string
): Promise<string | null> {
  const metadata = await fetchPackageMetadata(packageName);
  const versions = Object.keys(metadata.versions);
  
  // Sort versions descending
  const sortedVersions = versions
    .filter(v => !semver.prerelease(v))
    .sort((a, b) => semver.rcompare(a, b));
  
  for (const version of sortedVersions) {
    const versionMeta = metadata.versions[version];
    const reactPeerDep = getReactPeerDep(versionMeta);
    
    if (reactPeerDep && checkReactCompatibility(targetReactVersion, reactPeerDep) === 'compatible') {
      return version;
    }
  }
  
  return null;
}

/**
 * Analyze required companion upgrades when upgrading to a new version
 * This finds dependencies/peerDependencies that the new version requires
 * which are different from what's currently installed in the project
 */
async function analyzeRequiredUpgrades(
  packageName: string,
  targetVersion: string,
  projectDependencies: Record<string, string>
): Promise<RequiredUpgrade[]> {
  const requiredUpgrades: RequiredUpgrade[] = [];
  
  try {
    const metadata = await fetchPackageMetadata(packageName);
    const targetVersionMeta = metadata.versions[targetVersion];
    
    if (!targetVersionMeta) {
      return [];
    }
    
    // Combine dependencies and peerDependencies from the target version
    const peerDeps = targetVersionMeta.peerDependencies || {};
    const filteredPeerDeps: Record<string, string> = {};
    for (const [key, value] of Object.entries(peerDeps)) {
      if (value !== undefined) {
        filteredPeerDeps[key] = value;
      }
    }
    
    const targetDeps: Record<string, string> = {
      ...(targetVersionMeta.dependencies || {}),
      ...filteredPeerDeps,
    };
    
    // Check each dependency required by the new version
    for (const [depName, requiredRange] of Object.entries(targetDeps)) {
      // Skip react and react-dom as they're the target we're upgrading for
      if (depName === 'react' || depName === 'react-dom') {
        continue;
      }
      
      const currentVersion = projectDependencies[depName];
      
      if (!currentVersion) {
        // Skip new dependencies - only show existing packages that need upgrading
        continue;
      }
      
      // Clean the current version (remove ^ ~ etc)
      const cleanCurrentVersion = currentVersion.replace(/^[\^~>=<]+/, '');
      
      // Check if current version satisfies the required range
      try {
        const normalizedRange = semver.validRange(requiredRange);
        if (normalizedRange && !semver.satisfies(cleanCurrentVersion, normalizedRange)) {
          requiredUpgrades.push({
            name: depName,
            currentVersion: cleanCurrentVersion,
            requiredVersion: requiredRange,
          });
        }
      } catch {
        // If semver can't parse, skip this check
      }
    }
  } catch {
    // If we can't fetch metadata, return empty array
  }
  
  return requiredUpgrades;
}

/**
 * Analyze a single dependency for React compatibility
 */
export async function analyzeDependency(
  packageName: string,
  installedVersion: string,
  targetReactVersion: string,
  dependencyType: DependencyType,
  projectDependencies: Record<string, string>
): Promise<DependencyAnalysis> {
  try {
    const metadata = await fetchPackageMetadata(packageName);
    const latestVersion = metadata['dist-tags'].latest;
    
    // Get the peer dependencies for the installed version
    // Try to find the exact version or closest match
    const cleanVersion = installedVersion.replace(/^[\^~>=<]+/, '');
    const versionMeta = metadata.versions[cleanVersion] || 
                        findClosestVersion(metadata.versions, cleanVersion);
    
    if (!versionMeta) {
      return {
        name: packageName,
        installedVersion: cleanVersion,
        status: 'unknown',
        supportedReactRange: null,
        nearestCompatibleVersion: null,
        latestVersion,
        dependencyType,
        requiredUpgrades: [],
      };
    }
    
    const reactPeerDep = getReactPeerDep(versionMeta);
    const status = checkReactCompatibility(targetReactVersion, reactPeerDep);
    
    let nearestCompatibleVersion: string | null = null;
    let requiredUpgrades: RequiredUpgrade[] = [];
    
    if (status === 'incompatible') {
      nearestCompatibleVersion = await findNearestCompatibleVersion(
        packageName,
        cleanVersion,
        targetReactVersion
      );
      
      // If we found a compatible version, check what upgrades are required
      if (nearestCompatibleVersion) {
        requiredUpgrades = await analyzeRequiredUpgrades(
          packageName,
          nearestCompatibleVersion,
          projectDependencies
        );
      }
    }
    
    return {
      name: packageName,
      installedVersion: cleanVersion,
      status,
      supportedReactRange: reactPeerDep || null,
      nearestCompatibleVersion,
      latestVersion,
      dependencyType,
      requiredUpgrades,
    };
  } catch (error) {
    // If we can't fetch the package, return unknown status
    return {
      name: packageName,
      installedVersion: installedVersion.replace(/^[\^~>=<]+/, ''),
      status: 'unknown',
      supportedReactRange: null,
      nearestCompatibleVersion: null,
      latestVersion: 'unknown',
      dependencyType,
      requiredUpgrades: [],
    };
  }
}

/**
 * Find the closest version in the available versions
 */
function findClosestVersion(
  versions: Record<string, NpmVersionMetadata>,
  targetVersion: string
): NpmVersionMetadata | undefined {
  const availableVersions = Object.keys(versions).filter(v => !semver.prerelease(v));
  
  // Try to find an exact match first
  if (versions[targetVersion]) {
    return versions[targetVersion];
  }
  
  // Find the closest version that is less than or equal to target
  const sorted = availableVersions.sort((a, b) => semver.rcompare(a, b));
  for (const version of sorted) {
    if (semver.lte(version, targetVersion)) {
      return versions[version];
    }
  }
  
  // If no version is less than target, return the oldest available
  return versions[sorted[sorted.length - 1]];
}

/**
 * Filter out packages that are not React-related
 * (packages without React peer dependency that we should skip)
 */
export function isReactRelatedPackage(analysis: DependencyAnalysis): boolean {
  // If the package has a React peer dependency, it's React-related
  if (analysis.supportedReactRange !== null) {
    return true;
  }
  
  // Some packages that commonly depend on React but might not declare it
  const reactRelatedPackages = [
    'react', 'react-dom', 'react-scripts', 'react-router', 
    '@types/react', '@types/react-dom'
  ];
  
  return reactRelatedPackages.some(pkg => 
    analysis.name === pkg || analysis.name.startsWith(`${pkg}-`)
  );
}
