import { describe, it, expect } from 'vitest';
import { applyFixMode, collectCompanionUpgrades } from './upgrader.js';
import type { DependencyAnalysis } from '../types/index.js';

describe('applyFixMode', () => {
  const mockDeps: DependencyAnalysis[] = [
    {
      name: 'react-redux',
      installedVersion: '8.1.3',
      status: 'incompatible',
      supportedReactRange: '^16.8 || ^17.0 || ^18.0',
      nearestCompatibleVersion: '9.0.0',
      latestVersion: '9.2.0',
      dependencyType: 'dependencies',
      requiredUpgradesForNearest: [],
      requiredUpgradesForLatest: [],
    },
    {
      name: 'react-select',
      installedVersion: '3.0.4',
      status: 'incompatible',
      supportedReactRange: '^16.8.0',
      nearestCompatibleVersion: '5.9.0',
      latestVersion: '5.10.2',
      dependencyType: 'dependencies',
      requiredUpgradesForNearest: [],
      requiredUpgradesForLatest: [],
    },
  ];

  it('should return skip action for all deps when fix mode is none', () => {
    const selections = applyFixMode(mockDeps, 'none');

    expect(selections).toHaveLength(2);
    expect(selections.every(s => s.action === 'skip')).toBe(true);
  });

  it('should return nearest-compatible action when fix mode is nearest', () => {
    const selections = applyFixMode(mockDeps, 'nearest');

    expect(selections).toHaveLength(2);
    expect(selections[0].action).toBe('nearest-compatible');
    expect(selections[0].targetVersion).toBe('9.0.0');
    expect(selections[1].action).toBe('nearest-compatible');
    expect(selections[1].targetVersion).toBe('5.9.0');
  });

  it('should return latest action when fix mode is latest', () => {
    const selections = applyFixMode(mockDeps, 'latest');

    expect(selections).toHaveLength(2);
    expect(selections[0].action).toBe('latest');
    expect(selections[0].targetVersion).toBe('9.2.0');
    expect(selections[1].action).toBe('latest');
    expect(selections[1].targetVersion).toBe('5.10.2');
  });

  it('should fallback to latest when nearest not available', () => {
    const depsWithoutNearest: DependencyAnalysis[] = [
      {
        ...mockDeps[0],
        nearestCompatibleVersion: null,
      },
    ];

    const selections = applyFixMode(depsWithoutNearest, 'nearest');

    expect(selections[0].action).toBe('latest');
    expect(selections[0].targetVersion).toBe('9.2.0');
  });
});

describe('collectCompanionUpgrades', () => {
  const mockDeps: DependencyAnalysis[] = [
    {
      name: 'react-final-form',
      installedVersion: '6.5.9',
      status: 'incompatible',
      supportedReactRange: '^16.8.0 || ^17.0.0 || ^18.0.0',
      nearestCompatibleVersion: '7.0.0',
      latestVersion: '7.1.0',
      dependencyType: 'dependencies',
      requiredUpgradesForNearest: [
        { name: 'final-form', currentVersion: '4.20.0', requiredVersion: '^4.20.10' },
      ],
      requiredUpgradesForLatest: [
        { name: 'final-form', currentVersion: '4.20.0', requiredVersion: '^4.21.0' },
      ],
    },
  ];

  it('should collect companion upgrades for nearest-compatible action', () => {
    const selections = [
      {
        packageName: 'react-final-form',
        action: 'nearest-compatible' as const,
        targetVersion: '7.0.0',
      },
    ];

    const companions = collectCompanionUpgrades(selections, mockDeps);

    expect(companions).toHaveLength(1);
    expect(companions[0].name).toBe('final-form');
    expect(companions[0].requiredVersion).toBe('^4.20.10');
  });

  it('should collect companion upgrades for latest action', () => {
    const selections = [
      { packageName: 'react-final-form', action: 'latest' as const, targetVersion: '7.1.0' },
    ];

    const companions = collectCompanionUpgrades(selections, mockDeps);

    expect(companions).toHaveLength(1);
    expect(companions[0].name).toBe('final-form');
    expect(companions[0].requiredVersion).toBe('^4.21.0');
  });

  it('should not collect companions for skipped packages', () => {
    const selections = [
      { packageName: 'react-final-form', action: 'skip' as const, targetVersion: null },
    ];

    const companions = collectCompanionUpgrades(selections, mockDeps);

    expect(companions).toHaveLength(0);
  });

  it('should deduplicate companion packages', () => {
    const depsWithDuplicates: DependencyAnalysis[] = [
      ...mockDeps,
      {
        name: 'react-final-form-arrays',
        installedVersion: '3.1.4',
        status: 'incompatible',
        supportedReactRange: '^16.8.0 || ^17.0.0 || ^18.0.0',
        nearestCompatibleVersion: '4.0.0',
        latestVersion: '4.0.0',
        dependencyType: 'dependencies',
        requiredUpgradesForNearest: [
          { name: 'final-form', currentVersion: '4.20.0', requiredVersion: '^4.21.0' },
        ],
        requiredUpgradesForLatest: [
          { name: 'final-form', currentVersion: '4.20.0', requiredVersion: '^4.21.0' },
        ],
      },
    ];

    const selections = [
      {
        packageName: 'react-final-form',
        action: 'nearest-compatible' as const,
        targetVersion: '7.0.0',
      },
      {
        packageName: 'react-final-form-arrays',
        action: 'nearest-compatible' as const,
        targetVersion: '4.0.0',
      },
    ];

    const companions = collectCompanionUpgrades(selections, depsWithDuplicates);

    // Should only have one final-form entry (deduplicated)
    expect(companions).toHaveLength(1);
  });
});
