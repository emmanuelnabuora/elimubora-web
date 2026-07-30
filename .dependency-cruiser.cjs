/**
 * Architectural boundary enforcement. CI fails on violations.
 * These rules are the "microservice-ready seams" of the modular monolith.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-cross-domain-module-imports',
      comment:
        'Domain modules must not import from each other. Communicate via domain events (outbox) or public contracts in packages/domain.',
      severity: 'error',
      from: { path: '^apps/api/src/modules/([^/]+)/' },
      to: { path: '^apps/api/src/modules/(?!\\1)([^/]+)/' }
    },
    {
      name: 'packages-cannot-import-apps',
      comment: 'Shared packages must stay app-agnostic.',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' }
    },
    {
      name: 'web-cannot-import-api-internals',
      comment: 'Frontend talks to the API over HTTP only.',
      severity: 'error',
      from: { path: '^apps/web/' },
      to: { path: '^apps/api/' }
    },
    {
      name: 'core-cannot-import-domain-modules',
      comment: 'Core platform services must not depend on business modules.',
      severity: 'error',
      from: { path: '^apps/api/src/core/' },
      to: { path: '^apps/api/src/modules/' }
    },
    {
      name: 'modules-cannot-import-composition',
      comment:
        'The composition layer (cross-module read aggregation for dashboards/portals) depends on domain modules, never the reverse — prevents it becoming a backdoor coupling.',
      severity: 'error',
      from: { path: '^apps/api/src/modules/' },
      to: { path: '^apps/api/src/composition/' }
    }
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' }
  }
};
