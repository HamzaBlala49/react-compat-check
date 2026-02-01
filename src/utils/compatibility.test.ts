import { describe, it, expect } from 'vitest';
import { checkReactCompatibility } from './compatibility.js';

describe('checkReactCompatibility', () => {
  describe('compatible scenarios', () => {
    it('should return compatible for >= range that includes target', () => {
      expect(checkReactCompatibility('19.0.0', '>=16.8.0')).toBe('compatible');
      expect(checkReactCompatibility('19.0.0', '>=18.0.0')).toBe('compatible');
      expect(checkReactCompatibility('18.2.0', '>=16.8.0')).toBe('compatible');
    });

    it('should return compatible for exact caret range match', () => {
      expect(checkReactCompatibility('19.0.0', '^19.0.0')).toBe('compatible');
      expect(checkReactCompatibility('18.2.0', '^18.0.0')).toBe('compatible');
    });

    it('should return compatible for OR ranges with matching condition', () => {
      expect(checkReactCompatibility('19.0.0', '^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0')).toBe(
        'compatible'
      );
      expect(checkReactCompatibility('19.0.0', '^16.8.0 || >=18.0.0')).toBe('compatible');
    });

    it('should return compatible for hyphen ranges', () => {
      expect(checkReactCompatibility('18.0.0', '16.8 - 19')).toBe('compatible');
      expect(checkReactCompatibility('19.0.0', '16.8 - 19')).toBe('compatible');
    });

    it('should return compatible for >= range without patch version', () => {
      expect(checkReactCompatibility('19.0.0', '>=16.8')).toBe('compatible');
      expect(checkReactCompatibility('19.0.0', '>=16')).toBe('compatible');
    });
  });

  describe('incompatible scenarios', () => {
    it('should return incompatible for caret range that excludes target', () => {
      expect(checkReactCompatibility('19.0.0', '^18.0.0')).toBe('incompatible');
      expect(checkReactCompatibility('19.0.0', '^17.0.0')).toBe('incompatible');
    });

    it('should return incompatible for OR ranges without matching condition', () => {
      expect(checkReactCompatibility('19.0.0', '^16.8.0 || ^17.0.0 || ^18.0.0')).toBe(
        'incompatible'
      );
    });

    it('should return incompatible for exact version mismatch', () => {
      expect(checkReactCompatibility('19.0.0', '18.2.0')).toBe('incompatible');
    });

    it('should return incompatible when no React 19 support', () => {
      expect(checkReactCompatibility('19.0.0', '^16.6.3 || ^17.0.0')).toBe('incompatible');
    });
  });

  describe('unknown scenarios', () => {
    it('should return unknown for undefined peer dependency', () => {
      expect(checkReactCompatibility('19.0.0', undefined)).toBe('unknown');
    });

    it('should return unknown for empty string', () => {
      expect(checkReactCompatibility('19.0.0', '')).toBe('unknown');
    });
  });

  describe('edge cases', () => {
    it('should handle spaces in version ranges', () => {
      expect(checkReactCompatibility('19.0.0', '>= 16.8.0')).toBe('compatible');
      expect(checkReactCompatibility('19.0.0', '>=  16.8.0')).toBe('compatible');
    });

    it('should handle x.x format in ranges', () => {
      expect(checkReactCompatibility('19.0.0', '^15.x.x || ^16.x.x || ^17.x.x')).toBe(
        'incompatible'
      );
    });
  });
});
