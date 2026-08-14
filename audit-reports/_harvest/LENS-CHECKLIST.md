# In-session audit sweep — lens checklist

Findings ledger: `audit-reports/_harvest/findings.jsonl` (one JSON object per line, append-only).
Harvested NightyTidy findings: `audit-reports/_harvest/live-findings.json` (253 live).

Baseline commit for all line numbers: see `BASELINE` below.
Status: `todo` | `done`

BASELINE: e856782 (build: exclude .worktrees from eslint and vitest)

## Already covered by recovered NightyTidy runs (do not redo)
- [x] 24 type-safety — 141 live
- [x] 51 feature-discovery — 65 live
- [x] 08 test-efficiency — 40 live
- [x] 18 file-decomposition — 7 live

## Excluded by user
- 12 cli-coverage · 44 internationalization · 45 settings-system · 47 scheduled-jobs

## Batch A — code structure
- [ ] 16 codebase-cleanup
- [ ] 17 cross-cutting-concerns
- [ ] 19 function-centralization-discovery
- [ ] 20 building-block-adoption
- [ ] 21 code-elegance
- [ ] 22 architectural-complexity
- [ ] 23 scar-tissue-analysis
- [ ] 26 default-values-magic-constants
- [ ] 34 implicit-ordering-hidden-dependencies

## Batch B — correctness / runtime
- [ ] 37 bug-hunt
- [ ] 29 data-integrity
- [ ] 30 error-recovery
- [ ] 31 idempotency-safe-retry
- [ ] 33 race-condition
- [ ] 35 resource-lifecycle-cleanup
- [ ] 27 datetime-handling

## Batch C — boundaries / integration
- [ ] 11 contract-schema-drift
- [ ] 32 external-integration-reliability
- [ ] 10 api-design-consistency
- [ ] 02 contract-fidelity
- [ ] 09 integration-boundary-testing

## Batch D — security / privacy / deps
- [ ] 13 security-sweep
- [ ] 14 privacy-pii-handling
- [ ] 15 dependency-health

## Batch E — frontend / performance
- [ ] 40 frontend-quality
- [ ] 41 ui-ux
- [ ] 42 state-management
- [ ] 43 perceived-performance
- [ ] 38 performance
- [ ] 39 cost-resource-optimization

## Batch F — tests
- [ ] 03 test-coverage
- [ ] 04 test-hardening
- [ ] 05 test-architecture
- [ ] 06 test-consolidation
- [ ] 07 test-quality

## Batch G — errors / logging / docs
- [ ] 28 logging-error-quality
- [ ] 36 error-message-quality
- [ ] 01 documentation

## Batch H — ops / compliance
- [ ] 46 devops
- [ ] 48 observability
- [ ] 49 backup-check
- [ ] 25 universal-feature-compliance

## Batch I — product
- [ ] 50 product-polish
- [ ] 52 strategic-opportunities
