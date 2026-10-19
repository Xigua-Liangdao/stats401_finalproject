import assert from 'node:assert/strict';
import test from 'node:test';
import { interpretAssistant } from '../features/assistant/assistant-intent.js';

test('player and team lookups point at the catalogue name', () => {
  assert.deepEqual(interpretAssistant('我想看看Cube的数据'), { kind: 'lookup', name: 'Cube' });
  assert.deepEqual(interpretAssistant('我想看看 Team WE 的数据'), { kind: 'lookup', name: 'Team WE' });
  assert.deepEqual(interpretAssistant("show me Zdz's data"), { kind: 'lookup', name: 'Zdz' });
});

test('a chart question is a summary, not a catalogue lookup', () => {
  assert.deepEqual(interpretAssistant('这个vis说了什么'), { kind: 'summary' });
  assert.deepEqual(interpretAssistant('这张图在说什么'), { kind: 'summary' });
  assert.deepEqual(interpretAssistant('what does this chart say'), { kind: 'summary' });
});

test('other messages stay on the helper script', () => {
  assert.deepEqual(interpretAssistant('你好'), { kind: 'unknown' });
  assert.deepEqual(interpretAssistant('   '), { kind: 'empty' });
});
