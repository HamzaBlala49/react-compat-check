# react-compat-check

A CLI tool to analyze React project dependencies and determine compatibility with a target React version.

## Installation

```bash
# Run directly with npx (no installation required)
npx react-compat-check

# Or install globally
npm install -g react-compat-check

# Also works with yarn and pnpm
yarn dlx react-compat-check
pnpm dlx react-compat-check
```

## Usage

### Interactive Mode

Simply run the command in your React project directory:

```bash
npx react-compat-check
```

This will:
1. Prompt you to select a target React version
2. Analyze all dependencies for compatibility
3. Display a color-coded table of results
4. Show companion dependencies that need upgrading
5. Allow you to select upgrade actions for incompatible packages

### Non-Interactive Mode

Specify the React version directly:

```bash
npx react-compat-check --react 19
```

You can use:
- Major versions: `18`, `19`
- Minor versions: `18.2`
- Exact versions: `18.2.0`

### Command Line Options

| Option | Description |
|--------|-------------|
| `--react <version>` | Target React version to check compatibility against |
| `--include-dev` | Include devDependencies in analysis |
| `--include-optional` | Include optionalDependencies in analysis |
| `--json` | Output results as JSON (machine-readable) |
| `--fix <mode>` | Auto-fix mode: `nearest`, `latest`, or `none` |

### Examples

```bash
# Check compatibility with React 19
npx react-compat-check --react 19

# Include dev dependencies
npx react-compat-check --react 18 --include-dev

# Output JSON for CI/CD pipelines
npx react-compat-check --react 19 --json

# Auto-upgrade to nearest compatible versions
npx react-compat-check --react 19 --fix=nearest

# Auto-upgrade to latest versions
npx react-compat-check --react 19 --fix=latest
```

## Output

### Compatibility Table

The tool displays a table with the following columns:

| Column | Description |
|--------|-------------|
| Package | Dependency name |
| Installed | Currently installed version |
| Status | Compatibility status (Compatible/Incompatible) |
| Supported React | The React peer dependency range |
| Nearest Compatible | Lowest version newer than installed that supports target React |
| Latest | Latest published version |

### Status Colors

- 🟢 **Green (Compatible)**: Package supports the target React version
- 🔴 **Red (Incompatible)**: Package does not support the target React version

### Companion Dependencies

When upgrading packages, the tool detects **companion dependencies** that also need upgrading:

```
📦 Required Companion Upgrades:
  When upgrading these packages, you also need to upgrade their dependencies:

  react-final-form → 7.0.0 (nearest)
    └─ ↑ final-form 4.20.0 → ^4.21.0

  react-final-form → 7.1.0 (latest)
    └─ ↑ final-form 4.20.0 → ^4.22.0
```

The companion upgrades shown depend on your selection:
- **Nearest compatible**: Shows companion deps required for the nearest compatible version
- **Latest**: Shows companion deps required for the latest version

## Interactive Upgrade Flow

When incompatible packages are found, you can choose an action for each:

```
? react-select (current: 3.0.4, supports: ^16.8.0):
  ❯ Upgrade to nearest compatible (5.9.0)
    Upgrade to latest (5.10.2)
    Skip (ignore, move to next)
```

Options:
- **Upgrade to nearest compatible**: Upgrade to the lowest version that supports your target React
- **Upgrade to latest**: Upgrade to the latest published version
- **Skip**: Keep the current version, move to the next package

After selection, you'll see a summary including companion packages:

```
The following changes will be made:

  Packages to upgrade:
    react-final-form → 7.0.0
    react-redux → 9.2.0

  Companion packages:
    final-form 4.20.0 → ^4.21.0

? Proceed with changes? (Y/n)
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All dependencies are compatible |
| `1` | Incompatible dependencies detected |
| `2` | Runtime or network error |

## CI/CD Integration

Use the `--json` flag for machine-readable output:

```bash
npx react-compat-check --react 19 --json > compatibility-report.json
```

Use exit codes in CI pipelines:

```bash
npx react-compat-check --react 19 --fix=none || exit 1
```

### JSON Output Structure

```json
{
  "targetReactVersion": "19.0.0",
  "summary": {
    "total": 25,
    "compatible": 20,
    "incompatible": 5,
    "withRequiredUpgrades": 3
  },
  "hasIncompatible": true,
  "dependencies": [
    {
      "name": "react-final-form",
      "installedVersion": "6.5.9",
      "status": "incompatible",
      "supportedReactRange": "^16.8.0 || ^17.0.0 || ^18.0.0",
      "nearestCompatibleVersion": "7.0.0",
      "latestVersion": "7.0.0",
      "requiredUpgradesForNearest": [
        {
          "name": "final-form",
          "currentVersion": "4.20.0",
          "requiredVersion": "^4.21.0"
        }
      ],
      "requiredUpgradesForLatest": [...]
    }
  ]
}
```

## How It Works

1. **Reads** your project's `package.json`
2. **Fetches** npm registry metadata for each dependency
3. **Analyzes** `peerDependencies.react` using semantic versioning
4. **Evaluates** compatibility with your target React version
5. **Detects** companion dependencies that need upgrading
6. **Displays** results and offers upgrade options
7. **Auto-detects** package manager (npm/yarn/pnpm) for installation

## Package Manager Detection

The tool automatically detects your package manager based on lockfiles:

| Lockfile | Package Manager |
|----------|-----------------|
| `pnpm-lock.yaml` | pnpm |
| `yarn.lock` | yarn |
| `package-lock.json` | npm |

## Limitations

- Only analyzes packages with explicit React peer dependencies
- Does not perform code analysis or AST parsing
- Does not support React Native
- Does not include framework-specific logic (Next.js, Remix, etc.)

## License

MIT
