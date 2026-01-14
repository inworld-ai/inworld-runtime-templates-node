# Contributing to Inworld Runtime Templates

Thank you for your interest in contributing to the Inworld Runtime Templates! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- npm (v9 or higher) or Yarn
- Git
- An Inworld AI account and API key

### Development Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:

   ```bash
   git clone https://github.com/YOUR_USERNAME/inworld-runtime-templates-node.git
   cd inworld-runtime-templates-node
   ```

3. **Install dependencies**:

   ```bash
   npm install
   # or
   yarn install
   ```

4. **Set up environment variables**:
   Create a `.env` file in the root directory:

   ```bash
   INWORLD_API_KEY=your_api_key_here
   ```

5. **Verify the setup**:
   ```bash
   npm run build
   npm run lint
   npm run format:check
   ```

## Development Workflow

### Making Changes

1. **Create a feature branch**:

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes** and test them locally

3. **Run code quality checks** before committing:

   ```bash
   npm run lint          # Check for linting errors
   npm run lint:fix      # Auto-fix linting issues
   npm run format        # Format code with Prettier
   npm run format:check  # Verify formatting
   npm run type-check    # Check TypeScript types
   npm run build         # Ensure code compiles
   ```

4. **Test your changes**:
   
   Run the specific template you modified to ensure it works:

   ```bash
   npm run <template-script-name> [args]
   ```

5. **Commit your changes**:

   ```bash
   git add .
   git commit -m "Your descriptive commit message"
   ```

   Write clear, descriptive commit messages that explain what and why you changed something.

## Code Style

### TypeScript

- Use TypeScript strict mode
- Provide explicit types for function parameters and return values
- Avoid `any` types - use `unknown` or proper types instead
- Follow the existing code style and patterns
- Use JSDoc comments with type annotations for parameters (e.g., `@param {Type} paramName - description`)

### Formatting

- Code is automatically formatted with Prettier
- Run `npm run format` before committing
- Maximum line length: 80 characters
- Use single quotes for strings
- Use semicolons

### Linting

- ESLint is configured with TypeScript support
- All linting errors must be resolved before submitting a PR
- Run `npm run lint:fix` to auto-fix issues where possible

### File Structure

```
src/
├── llm/                # LLM templates
├── voice/              # Voice processing templates
├── retrieval/          # RAG and retrieval templates
├── safety/             # Safety and moderation templates
├── streaming/          # Streaming templates
├── text_processing/    # Text processing templates
├── observability/      # Observability templates
├── primitives/         # Low-level SDK primitives
├── utilities/          # Utility nodes
└── shared/             # Shared utilities and helpers
```

## Adding New Templates

When adding a new template:

1. **Choose the appropriate directory** based on the template's purpose
2. **Follow existing naming conventions** (e.g., `snake_case.ts`)
3. **Add a script entry** in `package.json` to run the template
4. **Include helpful comments** explaining what the template does
5. **Add CLI argument parsing** if applicable (see existing templates for patterns)
6. **Update documentation** if adding a new category or significant functionality

## Pull Request Process

1. **Update your fork**:

   ```bash
   git checkout main
   git pull upstream main
   git push origin main
   ```

2. **Create your PR**:
   - Push your branch to your fork
   - Open a Pull Request on GitHub
   - Fill out the PR template (if available)
   - Link any related issues

3. **PR Requirements**:
   - All tests pass (if applicable)
   - Code follows style guidelines
   - Linting passes (`npm run lint`)
   - Type checking passes (`npm run type-check`)
   - Build succeeds (`npm run build`)
   - Documentation is updated if needed
   - Template runs successfully with test data

4. **Code Review**:
   - Address any feedback from reviewers
   - Keep your PR focused on a single change
   - Keep commits clean and logical

## Reporting Issues

### Bug Reports

When reporting bugs, please include:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Environment details (Node.js version, OS, etc.)
- Relevant code snippets or error messages
- Which template is affected

### Feature Requests

For feature requests, please include:

- A clear description of the feature
- Use case and motivation
- Proposed implementation approach (if you have one)
- Which template category it belongs to

## Questions?

- **GitHub Issues**: [Open an issue](https://github.com/inworld-ai/inworld-runtime-templates-node/issues)
- **General Support**: support@inworld.ai

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

