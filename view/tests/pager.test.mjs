import test from 'node:test';
import assert from 'node:assert/strict';
import { pageMarks } from '../components/catalogue/paged-list.js';

test('five or fewer pages stay as a full row of buttons', () => {
  assert.deepEqual(pageMarks(1, 2), [1, 2]);
  assert.deepEqual(pageMarks(3, 5), [1, 2, 3, 4, 5]);
});

test('more than five pages keep the ends, with an ellipsis across any gap', () => {
  assert.deepEqual(pageMarks(1, 15), [1, 2, 3, 'ellipsis', 15]);
  assert.deepEqual(pageMarks(8, 15), [1, 'ellipsis', 6, 7, 8, 9, 10, 'ellipsis', 15]);
  assert.deepEqual(pageMarks(15, 15), [1, 'ellipsis', 13, 14, 15]);
  assert.deepEqual(pageMarks(4, 15), [1, 2, 3, 4, 5, 6, 'ellipsis', 15]);
});
