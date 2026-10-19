import assert from 'node:assert/strict';
import test from 'node:test';
import { gatewayUrls, originAllowed, readReply } from './src/worker.js';

test('the proxy accepts local preview and GitHub Pages only', () => {
  assert.equal(originAllowed('http://127.0.0.1:8700'), true);
  assert.equal(originAllowed('https://xuye.github.io'), true);
  assert.equal(originAllowed('https://xigua-liangdao.github.io'), true);
  assert.equal(originAllowed('https://example.com'), false);
  assert.equal(originAllowed(''), false);
  assert.equal(originAllowed('https://example.com', 'https://example.com'), true);
});

test('the school base URL is split into a model list and a chat call', () => {
  assert.deepEqual(gatewayUrls('https://aichat.dukekunshan.edu.cn:3443/v1'), {
    models: 'https://aichat.dukekunshan.edu.cn:3443/v1/models',
    chat: 'https://aichat.dukekunshan.edu.cn:3443/v1/chat/completions',
  });
  assert.equal(
    gatewayUrls('https://aichat.dukekunshan.edu.cn:3443/v1/chat/completions').chat,
    'https://aichat.dukekunshan.edu.cn:3443/v1/chat/completions',
  );
});

test('only the model text is returned to the page', () => {
  assert.equal(readReply({ choices: [{ message: { content: '  经济占比更高。 ' } }] }), '经济占比更高。');
  assert.equal(readReply({}), '');
});
