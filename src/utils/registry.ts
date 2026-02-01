import { request } from 'undici';
import type { NpmPackageMetadata } from '../types/index.js';

const NPM_REGISTRY_URL = 'https://registry.npmjs.org';

/**
 * Cache for package metadata to avoid repeated requests
 */
const metadataCache = new Map<string, NpmPackageMetadata>();

/**
 * Fetch package metadata from npm registry
 */
export async function fetchPackageMetadata(packageName: string): Promise<NpmPackageMetadata> {
  const cached = metadataCache.get(packageName);
  if (cached) {
    return cached;
  }

  const url = `${NPM_REGISTRY_URL}/${encodeURIComponent(packageName)}`;

  const { statusCode, body } = await request(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (statusCode === 404) {
    throw new Error(`Package "${packageName}" not found in npm registry`);
  }

  if (statusCode !== 200) {
    throw new Error(`Failed to fetch metadata for "${packageName}": HTTP ${statusCode}`);
  }

  const data = (await body.json()) as NpmPackageMetadata;
  metadataCache.set(packageName, data);

  return data;
}

/**
 * Fetch all available React versions from npm registry
 */
export async function fetchReactVersions(): Promise<string[]> {
  const metadata = await fetchPackageMetadata('react');
  const versions = Object.keys(metadata.versions);

  // Sort versions in descending order (newest first)
  return versions.sort((a, b) => {
    const aParts = a.split('.').map(p => parseInt(p, 10) || 0);
    const bParts = b.split('.').map(p => parseInt(p, 10) || 0);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal !== bVal) {
        return bVal - aVal;
      }
    }
    return 0;
  });
}

/**
 * Get the latest version of a package
 */
export async function getLatestVersion(packageName: string): Promise<string> {
  const metadata = await fetchPackageMetadata(packageName);
  return metadata['dist-tags'].latest;
}

/**
 * Get major React versions (latest of each major version)
 */
export async function getMajorReactVersions(): Promise<string[]> {
  const allVersions = await fetchReactVersions();
  const majorVersions = new Map<number, string>();

  for (const version of allVersions) {
    // Skip pre-release versions for major version display
    if (version.includes('-')) continue;

    const major = parseInt(version.split('.')[0], 10);
    if (!majorVersions.has(major)) {
      majorVersions.set(major, version);
    }
  }

  // Return sorted by major version descending
  return Array.from(majorVersions.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([_, version]) => version);
}

/**
 * Resolve a version string (could be major like "18" or exact like "18.2.0")
 * to an exact version
 */
export async function resolveReactVersion(versionInput: string): Promise<string> {
  const allVersions = await fetchReactVersions();

  // If it's already an exact version, verify it exists
  if (allVersions.includes(versionInput)) {
    return versionInput;
  }

  // If it's a major version (e.g., "18" or "19")
  const majorMatch = versionInput.match(/^(\d+)$/);
  if (majorMatch) {
    const major = parseInt(majorMatch[1], 10);
    // Find the latest stable version for this major
    const latestForMajor = allVersions.find(v => {
      if (v.includes('-')) return false;
      return parseInt(v.split('.')[0], 10) === major;
    });

    if (latestForMajor) {
      return latestForMajor;
    }
  }

  // If it's a partial version like "18.2", find the latest patch
  const partialMatch = versionInput.match(/^(\d+)\.(\d+)$/);
  if (partialMatch) {
    const [, major, minor] = partialMatch;
    const latestPatch = allVersions.find(v => {
      if (v.includes('-')) return false;
      const [vMajor, vMinor] = v.split('.');
      return vMajor === major && vMinor === minor;
    });

    if (latestPatch) {
      return latestPatch;
    }
  }

  throw new Error(`Invalid or unknown React version: "${versionInput}"`);
}
