import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.next/**', '**/.turbo/**', '**/generated/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  },

  // Module boundaries (architecture §2): inside apps/api each folder under src/
  // is a "module" and may only be reached through its public index.ts. The
  // composition root (src/index.ts) is allowed to wire them all together.
  {
    files: ['apps/api/src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['apps/api/src/**/*'],
      'boundaries/elements': [
        { type: 'root', mode: 'file', pattern: 'apps/api/src/index.ts' },
        { type: 'module', mode: 'folder', pattern: 'apps/api/src/*', capture: ['name'] },
      ],
      'import/resolver': {
        // lets boundaries follow ESM ".js" specifiers to their ".ts" source
        typescript: { alwaysTryTypes: true },
      },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            // a module's own files may import each other freely
            {
              from: { type: 'module', captured: { name: '{{from.name}}' } },
              allow: { to: { type: 'module', captured: { name: '{{from.name}}' } } },
            },
            // anything may reach a module only through its public index.ts
            {
              from: { type: ['root', 'module'] },
              allow: { to: { type: 'module', internalPath: 'index.ts' } },
            },
          ],
        },
      ],
    },
  },
);
