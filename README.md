# GraphQL Sniper 🎯

A powerful GraphQL API auditing and testing tool designed for security researchers, penetration testers, and developers. GraphQL Sniper enables rapid iteration on GraphQL queries, mutations, and subscriptions by providing an intuitive interface for modifying and resending requests while automatically building a comprehensive wordlist from API interactions.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Project File Structure](#project-file-structure)
- [Installation](#installation)
- [Usage](#usage)
  - [Getting Started](#getting-started)
  - [Using the Proxy](#using-the-proxy)
  - [Working with Wordlists](#working-with-wordlists)
- [Use Cases](#use-cases)
- [Configuration](#configuration)
- [Development](#development)
- [Potential Next Steps](#potential-next-steps)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

GraphQL Sniper is a specialized auditing tool that streamlines the process of testing GraphQL APIs by:

- **Quickly iterating** on GraphQL requests with live editing
- **Testing arguments, fields, and variables** within queries, mutations, and subscriptions
- **Automatically extracting** field names, operation names, and parameter names into a reusable wordlist
- **Bypassing CORS restrictions** with an optional local proxy server
- **Beautifying and formatting** GraphQL queries and JSON variables for readability

Built with React, TypeScript, and CodeMirror, GraphQL Sniper provides a modern, responsive interface optimized for security testing workflows.

## ✨ Features

### Core Functionality

- **🔄 Live Query Editor**: Edit GraphQL queries with syntax highlighting and auto-formatting
- **📝 Variable Management**: JSON editor for GraphQL variables with validation
- **🚀 Quick Send**: Rapidly send modified requests to test different parameters
- **📊 Response Viewer**: View formatted HTTP responses with status, headers, and body
- **🔧 Raw Request Import**: Paste raw JSON request bodies to auto-populate query and variables

### Security Testing Features

- **📚 Automatic Wordlist Generation**: Extracts all field names, arguments, types, and values from requests and responses
- **💾 Wordlist Management**: Import, export, copy, and clear wordlists for use with other tools (Burp Suite, ffuf, etc.)
- **🔐 Custom Headers**: Configure authentication tokens, custom headers, and more
- **🌐 CORS Bypass Proxy**: Local Node.js proxy to bypass CORS restrictions during testing
- **🎨 Token Splitting**: Intelligently splits camelCase and snake_case identifiers into individual words

### Developer Experience

- **🎯 Dark Theme UI**: Eye-friendly interface for extended testing sessions
- **⚡ Fast Iteration**: No page reloads, instant feedback
- **📱 Responsive Design**: Works on various screen sizes
- **🔍 Syntax Validation**: Real-time GraphQL and JSON syntax checking

## 📁 Project File Structure

```
graphql-sniper/
├── server/
│   └── proxy.mjs              # Node.js HTTP/HTTPS proxy server for CORS bypass
├── src/
│   ├── App.tsx                # Main application component with all UI logic
│   ├── main.tsx               # React application entry point
│   └── index.css              # Global styles and Tailwind imports
├── index.html                 # HTML entry point
├── package.json               # Project dependencies and scripts
├── vite.config.ts             # Vite bundler configuration
├── tsconfig.json              # TypeScript configuration (main)
├── tsconfig.node.json         # TypeScript configuration (Node.js)
├── tailwind.config.ts         # Tailwind CSS configuration
├── postcss.config.cjs         # PostCSS configuration for Tailwind
├── .gitignore                 # Git ignore rules
├── LICENSE                    # MIT License
└── README.md                  # This file
```

### Key Files Explained

- **`src/App.tsx`**: The heart of the application containing:
  - GraphQL query parsing and formatting logic
  - HTTP request/response handling
  - Wordlist extraction and management
  - All UI components and state management

- **`server/proxy.mjs`**: Standalone HTTP proxy server that:
  - Forwards requests to target GraphQL APIs
  - Adds CORS headers to bypass browser restrictions
  - Supports both HTTP and HTTPS targets
  - Returns detailed response information

- **`vite.config.ts`**: Development server and build configuration
- **`tailwind.config.ts`**: Styling framework configuration for UI theming

## 🚀 Installation

### Prerequisites

- **Node.js** v18 or higher
- **npm** or **yarn** package manager

### Steps

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd graphql-sniper
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Start the proxy server** (in a separate terminal):
   ```bash
   npm run proxy
   ```

5. **Open your browser** to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The production build will be output to the `dist/` directory.

## 📖 Usage

### Getting Started

1. **Enter Target URL**: Input the GraphQL endpoint URL (e.g., `https://api.example.com/graphql`)

2. **Configure Headers**: Add any required headers (Authorization tokens, API keys, etc.):
   ```
   Authorization: Bearer YOUR_TOKEN_HERE
   X-API-Key: your-api-key
   ```

3. **Import a Request**: Paste a raw GraphQL JSON request body:
   ```json
   {
     "operationName": "GetUser",
     "variables": {"userId": "123"},
     "query": "query GetUser($userId: ID!) { user(id: $userId) { id name email } }"
   }
   ```

4. **Edit and Test**: Modify the query or variables in the live editors

5. **Send Request**: Click the "Send" button to execute the request

6. **Review Response**: Inspect the HTTP status, headers, and response body

### Using the Proxy

The local proxy server helps bypass CORS restrictions when testing third-party APIs:

1. **Start the proxy**:
   ```bash
   npm run proxy
   ```
   
2. **Enable proxy in UI**: Check the "Use local proxy" checkbox

3. **Configure proxy URL** (default: `http://localhost:8787/forward`)

4. **Send requests**: All requests will now route through the proxy

**Note**: The proxy server should only be used for testing and development purposes on local or authorized targets.

### Working with Wordlists

GraphQL Sniper automatically builds a wordlist from:
- GraphQL field names
- Operation names
- Argument names
- Type names
- Variable keys and string values
- Response data fields and values

**Wordlist Actions**:

- **Copy**: Copy the entire wordlist to clipboard
- **Export**: Download as `wordlist.txt`
- **Import**: Load an existing wordlist from a text file
- **Clear**: Reset the wordlist

The wordlist uses intelligent tokenization to split compound words:
- `getUserData` → `get`, `user`, `data`, `getuserdata`
- `user_profile` → `user`, `profile`, `user_profile`

## 🎯 Use Cases

### Security Testing & Penetration Testing

1. **GraphQL Enumeration**:
   - Build comprehensive wordlists of field names, types, and operations
   - Use extracted words with fuzzing tools (ffuf, wfuzz, Burp Intruder)
   - Discover hidden fields and undocumented APIs

2. **Authorization Testing**:
   - Quickly test different authentication tokens
   - Modify user IDs and resource identifiers in variables
   - Test horizontal and vertical privilege escalation

3. **Input Validation Testing**:
   - Rapidly iterate through injection payloads
   - Test different data types for type confusion vulnerabilities
   - Fuzz query arguments and variables

4. **IDOR (Insecure Direct Object Reference) Testing**:
   - Systematically test object IDs and references
   - Modify nested object identifiers in complex queries
   - Document vulnerable endpoints

### Development & Debugging

1. **API Exploration**:
   - Test new GraphQL endpoints during development
   - Experiment with query structures and arguments
   - Debug response formats and error handling

2. **Schema Discovery**:
   - Build a vocabulary of API operations and fields
   - Document available queries and mutations
   - Extract naming conventions and patterns

3. **Integration Testing**:
   - Test API integrations with different variable combinations
   - Verify response formats and data structures
   - Validate error handling and edge cases

### Bug Bounty Hunting

1. **Rapid Testing Workflow**:
   - Quickly import requests from browser DevTools or Burp Suite
   - Iterate through parameter values at speed
   - Export findings for reporting

2. **Wordlist Building**:
   - Generate custom wordlists specific to target applications
   - Combine with general GraphQL wordlists for comprehensive coverage
   - Use with automated scanning tools

## ⚙️ Configuration

### Environment Variables

**Proxy Server**:
```bash
# Set custom proxy port (default: 8787)
PORT=9000 npm run proxy
```

**Vite Dev Server**:
Edit `vite.config.ts` to customize:
```typescript
export default defineConfig({
  server: {
    host: true,      // Listen on all interfaces
    port: 5173,      // Development server port
  },
})
```

### Customizing the UI

The interface uses Tailwind CSS. Modify `tailwind.config.ts` and `src/index.css` to customize colors, spacing, and themes.

## 🛠️ Development

### Running Tests

```bash
# Type checking
npm run typecheck
```

### Development Workflow

1. **Start dev server**: `npm run dev` (hot reload enabled)
2. **Start proxy**: `npm run proxy` (in separate terminal)
3. **Make changes**: Edit files in `src/`
4. **Build**: `npm run build`
5. **Preview**: `npm run preview`

### Tech Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3
- **Code Editor**: CodeMirror 6
- **GraphQL Parsing**: graphql.js
- **Proxy Server**: Node.js built-in http/https modules

## 🚧 Potential Next Steps

### Short-term Enhancements

1. **Request History**:
   - Save and replay previous requests
   - Bookmark favorite queries
   - Quick diff between requests

2. **Response Diff Viewer**:
   - Compare responses side-by-side
   - Highlight changes between requests
   - Track API behavior changes

3. **Batch Testing**:
   - Load multiple test cases from file
   - Run queries in sequence or parallel
   - Generate test reports

4. **Enhanced Wordlist Features**:
   - Regex filtering and search
   - Wordlist categories (fields, types, operations)
   - Auto-suggest based on wordlist
   - Integration with SecLists or other wordlist databases

### Mid-term Features

5. **GraphQL Introspection**:
   - Auto-generate queries from schema
   - Visual schema explorer
   - Detect enabled introspection

6. **Fuzzing Integration**:
   - Built-in payload library (XSS, SQLi, IDOR)
   - Automated parameter fuzzing
   - Response anomaly detection

7. **Request Collections**:
   - Organize requests into projects
   - Import/export Postman/Insomnia collections
   - Team collaboration features

8. **Authentication Helpers**:
   - OAuth2 flow support
   - JWT decoder/editor
   - Session management

### Long-term Vision

9. **Automated Vulnerability Scanning**:
   - Common GraphQL vulnerability checks
   - Authorization bypass detection
   - Rate limiting and DoS testing

10. **Report Generation**:
    - Export findings to Markdown/PDF
    - Screenshot capture
    - Integration with bug bounty platforms

11. **Collaborative Features**:
    - Cloud sync for wordlists and queries
    - Real-time collaboration
    - Shared workspace for teams

12. **Browser Extension**:
    - Capture GraphQL requests from any page
    - One-click import to GraphQL Sniper
    - Inline editing in DevTools

13. **Performance Testing**:
    - Query complexity analysis
    - Response time tracking
    - Load testing capabilities

14. **Advanced Proxy Features**:
    - SSL/TLS interception
    - Request/response modification rules
    - Logging and replay

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines

- Follow the existing code style
- Add TypeScript types for new features
- Test your changes thoroughly
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Disclaimer**: This tool is intended for authorized security testing and development purposes only. Always obtain proper authorization before testing any systems you do not own. The authors are not responsible for misuse or damage caused by this tool.
