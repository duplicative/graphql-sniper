# Gemini Code Assistant Context

see AGENTS.md for additional information

## Project Overview

This project is a **GraphQL Sniper**, a powerful GraphQL API auditing and testing tool. It's designed for security researchers, penetration testers, and developers to rapidly iterate on GraphQL queries, mutations, and subscriptions.

The frontend is a single-page application built with **React** and **TypeScript**, using **Vite** for bundling and development. It features a live query editor with syntax highlighting (CodeMirror), variable management, and a response viewer. The UI is styled with **Tailwind CSS**.

A local **Node.js proxy server** is included to bypass CORS restrictions during testing.

The project also includes a testing suite using **Vitest** and **React Testing Library**.

## Building and Running

### Prerequisites

*   Node.js v18 or higher
*   npm

### Development

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Start the development server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:5173`.

3.  **Start the proxy server (in a separate terminal):**
    ```bash
    npm run proxy
    ```
    The proxy will be available at `http://localhost:8787`.

### Building for Production

```bash
npm run build
```

The production-ready files will be located in the `dist/` directory.

### Running Tests

*   **Run all tests:**
    ```bash
    npm test
    ```

*   **Run tests with UI:**
    ```bash
    npm run test:ui
    ```

*   **Run tests and generate coverage report:**
    ```bash
    npm run test:coverage
    ```

## Development Conventions

*   **Code Style:** The project follows standard TypeScript and React conventions.
*   **Testing:** Tests are written with Vitest and React Testing Library. Test files are located in the `src/test/` directory and have a `.test.tsx` extension.
*   **State Management:** The `FuzzerContext` (`src/FuzzerContext.tsx`) is used for state management related to the fuzzer functionality.
*   **Routing:** `react-router-dom` is used for routing. The main routes are defined in `src/App.tsx`.
*   **Styling:** Tailwind CSS is used for styling. The configuration is in `tailwind.config.ts`.
