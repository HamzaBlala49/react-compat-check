# react-compat-check

A CLI tool to analyze React project dependencies and determine compatibility with a target React version.

## Installation

```bash
# Run directly with npx (no installation required)
npx react-compat-check

# Or install globally
npm install -g react-compat-check
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
4. Allow you to select upgrade actions for incompatible packages

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

The tool displays a table with the following columns:

| Column | Description |
|--------|-------------|
| Package | Dependency name |
| Installed | Currently installed version |
| Status | Compatibility status (Compatible/Incompatible/Unknown) |
| Supported React | The React peer dependency range |
| Nearest Compatible | Lowest version newer than installed that supports target React |
| Latest | Latest published version |

### Status Colors

- 🟢 **Green**: Compatible with target React version
- 🔴 **Red**: Incompatible with target React version
- 🟡 **Yellow**: Unknown (no React peer dependency declared)

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

## How It Works

1. **Reads** your project's `package.json`
2. **Fetches** npm registry metadata for each dependency
3. **Analyzes** `peerDependencies.react` using semantic versioning
4. **Evaluates** compatibility with your target React version
5. **Displays** results and offers upgrade options

## Limitations

- Only analyzes packages with explicit React peer dependencies
- Does not perform code analysis or AST parsing
- Does not support React Native
- Does not include framework-specific logic (Next.js, Remix, etc.)

## License

MIT
