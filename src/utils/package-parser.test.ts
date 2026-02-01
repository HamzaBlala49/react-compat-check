import { describe, it, expect } from 'vitest';
import { getDependencies, extractInstalledVersion } from './package-parser.js';
import type { PackageJson } from '../types/index.js';

describe('getDependencies', () => {
  const mockPackageJson: PackageJson = {
    name: 'test-project',
    version: '1.0.0',
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0',
      'react-redux': '^8.1.0',
    },
    devDependencies: {
      typescript: '^5.0.0',
      '@types/react': '^18.2.0',
    },
    optionalDependencies: {
      'optional-package': '^1.0.0',
    },
  };

  it('should return only regular dependencies by default', () => {
    const deps = getDependencies(mockPackageJson, {
      includeDev: false,
      includeOptional: false,
    });

    expect(deps).toHaveLength(3);
    expect(deps.map(d => d.name)).toContain('react');
    expect(deps.map(d => d.name)).toContain('react-dom');
    expect(deps.map(d => d.name)).toContain('react-redux');
    expect(deps.every(d => d.type === 'dependencies')).toBe(true);
  });

  it('should include dev dependencies when flag is set', () => {
    const deps = getDependencies(mockPackageJson, {
      includeDev: true,
      includeOptional: false,
    });

    expect(deps).toHaveLength(5);
    expect(deps.map(d => d.name)).toContain('typescript');
    expect(deps.map(d => d.name)).toContain('@types/react');
  });

  it('should include optional dependencies when flag is set', () => {
    const deps = getDependencies(mockPackageJson, {
      includeDev: false,
      includeOptional: true,
    });

    expect(deps).toHaveLength(4);
    expect(deps.map(d => d.name)).toContain('optional-package');
  });

  it('should include all dependencies when both flags are set', () => {
    const deps = getDependencies(mockPackageJson, {
      includeDev: true,
      includeOptional: true,
    });

    expect(deps).toHaveLength(6);
  });

  it('should handle empty package.json', () => {
    const emptyPackageJson: PackageJson = {};
    const deps = getDependencies(emptyPackageJson, {
      includeDev: true,
      includeOptional: true,
    });

    expect(deps).toHaveLength(0);
  });
});

describe('extractInstalledVersion', () => {
  it('should remove caret prefix', () => {
    expect(extractInstalledVersion('^1.2.3')).toBe('1.2.3');
  });

  it('should remove tilde prefix', () => {
    expect(extractInstalledVersion('~1.2.3')).toBe('1.2.3');
  });

  it('should remove >= prefix', () => {
    expect(extractInstalledVersion('>=1.2.3')).toBe('1.2.3');
  });

  it('should handle exact versions', () => {
    expect(extractInstalledVersion('1.2.3')).toBe('1.2.3');
  });

  it('should handle complex ranges by extracting first version', () => {
    expect(extractInstalledVersion('^1.2.3 || ^2.0.0')).toBe('1.2.3');
  });
});
