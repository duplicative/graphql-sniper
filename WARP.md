# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Core Development
- **Dev server**: `npm run dev` - Starts Vite dev server on port 5173 with hot reload
- **Build**: `npm run build` - TypeScript compilation + Vite production build  
- **Preview**: `npm run preview` - Preview production build locally
- **Type check**: `npm run typecheck` - Run TypeScript compiler without emitting files

### Proxy Server
- **Start proxy**: `npm run proxy` - Starts local HTTP/HTTPS proxy on port 8787
- **Debug proxy**: `DEBUG=1 npm run proxy` - Starts proxy with comprehensive debug logging
- **Custom port**: `PORT=9000 npm run proxy` - Start proxy on custom port

### Typical Development Workflow
```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Start proxy server  
npm run proxy

# Optional: Run type checking
npm run typecheck
```

## Architecture Overview

### Application Structure
GraphQL Sniper is a React-based single-page application with a companion Node.js proxy server for CORS bypass during security testing.

**Core Files:**
- `src/App.tsx` - Single-file React app containing all UI logic, state management, and GraphQL/wordlist processing
- `server/proxy.mjs` - Standalone HTTP/HTTPS proxy server with CORS headers and request forwarding
- `src/main.tsx` - React entry point with StrictMode wrapper

### Key Architecture Patterns

**State Management**: Uses React hooks (useState, useMemo) with local component state. No external state management library.

**Data Flow**: 
1. Raw GraphQL JSON → Parse → Beautify → CodeMirror editors
2. User edits → Send request → Response display → Wordlist extraction
3. All GraphQL parsing, validation, and wordlist building happens in `App.tsx`

**Proxy Architecture**: 
- Separate Node.js server process (`server/proxy.mjs`)
- Forwards requests with proper headers and TLS configuration
- Bypasses CORS restrictions for security testing
- Supports HTTP/HTTPS targets with timeout handling

### Code Organization Principles

**Single Responsibility per File**:
- `App.tsx`: All UI components, business logic, and state in one file (intentional monolith for this tool)
- `proxy.mjs`: Only HTTP forwarding and CORS handling
- `main.tsx`: Only React bootstrapping

**Functional Programming Style**:
- Pure utility functions for GraphQL parsing, wordlist extraction, JSON formatting
- Immutable state updates using React patterns
- Arrow functions and modern ES6+ features throughout

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite 5
- **Styling**: Tailwind CSS 3 with dark theme
- **Code Editing**: CodeMirror 6 with GraphQL and JSON syntax highlighting
- **GraphQL**: graphql.js for AST parsing, validation, and pretty-printing
- **Proxy**: Node.js built-in http/https modules with custom TLS configuration

## Development Context

### Purpose
GraphQL Sniper is a security testing tool for GraphQL APIs, designed for:
- Rapid iteration on GraphQL queries during penetration testing
- Automatic wordlist building from API responses
- CORS bypass for testing third-party endpoints
- Bug bounty hunting and security research workflows

### Key Features Implemented
- **Live GraphQL Editor**: Real-time syntax highlighting and validation
- **Automatic Wordlist Generation**: Extracts field names, types, and values from requests/responses
- **Request/Response Handling**: Full HTTP request lifecycle with headers and proxy support
- **Smart Word Tokenization**: Splits camelCase and snake_case into individual tokens

### Code Style Conventions
- **Imports**: React imports first, then third-party libraries, then local utilities
- **Functions**: Arrow functions preferred, pure functions for utilities
- **Types**: Use `type` for aliases, `interface` for object shapes
- **Error Handling**: Try-catch blocks, often with empty catch for non-critical errors
- **Naming**: camelCase for variables/functions, PascalCase for React components/types
- **Formatting**: 2-space indentation, consistent spacing, minimal comments

### Important Implementation Details

**GraphQL Processing**: Uses `graphql.js` library's AST visitor pattern to extract all identifiers (fields, operations, arguments, types) for wordlist building.

**Wordlist Intelligence**: Implements smart tokenization that splits compound words:
- `getUserData` → `["get", "user", "data", "getuserdata"]`
- `user_profile` → `["user", "profile", "user_profile"]`

**Proxy Security Features**:
- Configurable TLS versions (1.2-1.3) with secure cipher suites  
- Browser-like User-Agent spoofing to avoid detection
- Proper timeout handling (30s default)
- Comprehensive debug logging for troubleshooting

**State Persistence**: No localStorage or external persistence - all state is session-based and resets on page reload (intentional design for security testing).

### Testing Notes
- No test framework currently configured
- Type checking serves as primary validation: `npm run typecheck`
- Manual testing workflow: dev server + proxy + real GraphQL endpoints
- Proxy can be tested independently with DEBUG=1 flag for troubleshooting

### Deployment
- Production build outputs to `dist/` directory
- Static files only - can be served from any HTTP server
- Proxy server needs to run separately if CORS bypass is required