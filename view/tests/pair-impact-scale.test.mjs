import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedPairHeatmapLimit } from '../features/pair-impact/pair-impact-scale.js';

test('a shared symmetric domain includes both panels and sparse scores', () => {
  const left = { limit: 0.2, cells: [{ kind: 'eligible', value: 0.2 }, { kind: 'sparse', value: -0.7 }] };
  const right = { limit: 0.4, cells: [{ kind: 'eligible', value: -0.4 }, { kind: 'eligible', value: 0.2 }] };
  assert.equal(sharedPairHeatmapLimit([left, right]), 0.7);
  assert.equal(sharedPairHeatmapLimit([right, left]), 0.7);
  assert.equal(left.limit, 0.2, 'the standalone scale is unchanged');
  assert.equal(right.limit, 0.4, 'the standalone scale is unchanged');
});

test('missing panels and invalid scores cannot poison the domain', () => {
  const empty = { cells: [null, undefined, NaN, Infinity, -Infinity, '0.8'].map((value) => ({ value })) };
  assert.equal(sharedPairHeatmapLimit([null, undefined, {}, empty]), 0.15);
  assert.equal(sharedPairHeatmapLimit([empty, { cells: [{ value: -0.9 }] }]), 0.9);
});

test('empty, zero, and near-zero scores keep a nondegenerate symmetric range', () => {
  assert.equal(sharedPairHeatmapLimit([]), 0.15);
  assert.equal(sharedPairHeatmapLimit([{ cells: [] }]), 0.15);
  assert.equal(sharedPairHeatmapLimit([{ cells: [{ value: 0 }, { value: -0.02 }, { value: 0.04 }] }]), 0.15);
});
