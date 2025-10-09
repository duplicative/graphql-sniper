# Agent Guidelines for graphql-sniper

## Commands
- **Build**: `npm run build` (TypeScript + Vite)
- **Dev server**: `npm run dev`
- **Type check**: `npm run typecheck`
- **Proxy server**: `npm run proxy`
- **Proxy server with debug**: `DEBUG=1 npm run proxy`
- **Single test**: No test framework configured

## Proxy Features
- **Header Forwarding**: Forwards all user headers transparently, adds browser-like defaults
- **TLS Support**: Configurable TLS versions and cipher suites
- **Debug Logging**: Comprehensive logging with `DEBUG=1` for troubleshooting
- **Timeout Handling**: 30-second default timeout with proper error handling
- **Browser Simulation**: Suppresses Node.js fingerprints, mimics browser traffic

## Code Style
- **Imports**: React first, then third-party, then local. Use named imports.
- **Formatting**: 2-space indentation, consistent spacing
- **Types**: Strict TypeScript. Use `type` for aliases, `interface` for objects.
- **Naming**: camelCase variables/functions, PascalCase components/types
- **Error handling**: Try-catch with empty blocks for non-critical errors
- **React**: Functional components, hooks, useMemo for expensive computations
- **Patterns**: Arrow functions, destructuring, optional chaining, template literals
- **Comments**: Minimal, only for complex logic
- **File structure**: Flat src/, server/ for backend