import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouteTransition } from '../utils/route-transition.js';

test('late route data cannot append into or replace a newer page', async () => {
  const savedWindow = globalThis.window;
  const savedDocument = globalThis.document;
  const node = () => ({
    childNodes: [], style: {}, classList: { add() {}, remove() {} }, setAttribute() {},
    get childElementCount() { return this.childNodes.length; },
    append(value) { this.childNodes.push(value); },
    replaceChildren(...children) { this.childNodes = children; },
  });
  globalThis.window = { matchMedia: () => ({ matches: true }), scrollTo() {} };
  globalThis.document = { createElement: node };
  try {
    const app = node();
    const transition = createRouteTransition(app, node());
    let finishOld;
    const oldData = new Promise((resolve) => { finishOld = resolve; });
    const old = transition(async (target) => { await oldData; target.append('old league'); });
    await transition(async (target) => { target.append('new league'); });
    assert.deepEqual(app.childNodes, ['new league']);
    finishOld();
    await old;
    assert.deepEqual(app.childNodes, ['new league']);
  } finally {
    globalThis.window = savedWindow;
    globalThis.document = savedDocument;
  }
});
