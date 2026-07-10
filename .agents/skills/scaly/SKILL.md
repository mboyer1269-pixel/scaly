```markdown
# scaly Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the `scaly` TypeScript codebase. You'll learn about file naming, import/export styles, commit message conventions, and how to write and run tests using `vitest`. The repository follows clean, conventional commit patterns and a modular TypeScript structure without a specific framework.

## Coding Conventions

### File Naming
- Use **camelCase** for all file names.
  - Example: `myModule.ts`, `userService.ts`

### Import Style
- Use **alias imports** to reference modules.
  - Example:
    ```typescript
    import { myFunction } from '@/utils/myFunction'
    ```

### Export Style
- Use **named exports** for all modules.
  - Example:
    ```typescript
    export const myFunction = () => { /* ... */ }
    ```

### Commit Messages
- Use **conventional commits** with the `feat` prefix for features.
  - Example:
    ```
    feat: add user authentication module
    ```

## Workflows

_No automated workflows detected in this repository._

## Testing Patterns

- **Test Framework:** [vitest](https://vitest.dev/)
- **Test File Naming:** Suffix test files with `.test.ts`
  - Example: `myModule.test.ts`
- **Writing Tests:**
  - Example:
    ```typescript
    import { describe, it, expect } from 'vitest'
    import { myFunction } from './myFunction'

    describe('myFunction', () => {
      it('should return true', () => {
        expect(myFunction()).toBe(true)
      })
    })
    ```
- **Running Tests:**
  - Use the `vitest` CLI to run all tests:
    ```
    npx vitest
    ```

## Commands
| Command         | Purpose                                 |
|-----------------|-----------------------------------------|
| /run-tests      | Run all vitest test suites              |
| /lint           | Lint the codebase (if linter configured)|
| /commit-feat    | Create a conventional feat commit       |
```