import { strict as assert } from 'assert';
import expect from 'expect';
import cheerio from 'cheerio';
import { type, when } from 'interactor.js';
import { withExample } from './helpers';
import serializeDOM from '../src';

describe('serializeFrames', () => {
  let $;

  beforeEach(async function() {
    this.timeout(5000);

    withExample(`
      <iframe id="frame-external" src="https://example.com"></iframe>
      <iframe id="frame-external-fail" src="https://google.com"></iframe>
      <iframe id="frame-input" srcdoc="<input/>"></iframe>
      <iframe id="frame-js" src="javascript:void(
        this.document.body.innerHTML = '<p>made with js src</p>'
      )"></iframe>
      <iframe id="frame-js-no-src"></iframe>
    `);

    let $frameInput = document.getElementById('frame-input');
    await when(() => assert($frameInput.contentWindow.performance.timing.loadEventEnd, '#frame-input did not load in time'));
    await type($frameInput.contentDocument.querySelector('input'), 'iframe with an input');

    let $frameJS = document.getElementById('frame-js-no-src');
    $frameJS.contentDocument.body.innerHTML = '<p>generated iframe</p>';

    let $frameHead = document.createElement('iframe');
    $frameHead.id = 'frame-head';
    document.head.appendChild($frameHead);

    // ensure external frame has loaded for coverage
    let $frameExt = document.getElementById('frame-external');
    await when(() => assert(!$frameExt.contentDocument, '#frame-external did not load in time'), 3000);

    let $frameInject = document.createElement('iframe');
    $frameInject.id = 'frame-inject';
    $frameInject.src = 'javascript:false';
    $frameInject.sandbox = '';
    document.getElementById('test').appendChild($frameInject);

    $ = cheerio.load(serializeDOM());
  });

  afterEach(() => {
    document.querySelector('#frame-head').remove();
  });

  it('serializes iframes created with JS', () => {
    expect($('#frame-js').attr('src')).toBeUndefined();
    expect($('#frame-js').attr('srcdoc')).toBe([
      '<!DOCTYPE html><html><head></head><body>',
      '<p>made with js src</p>',
      '</body></html>'
    ].join(''));

    expect($('#frame-js-no-src').attr('src')).toBeUndefined();
    expect($('#frame-js-no-src').attr('srcdoc')).toBe([
      '<!DOCTYPE html><html><head></head><body>',
      '<p>generated iframe</p>',
      '</body></html>'
    ].join(''));
  });

  it('serializes iframes that have been interacted with', () => {
    expect($('#frame-input').attr('srcdoc')).toMatch(new RegExp([
      '^<!DOCTYPE html><html><head></head><body>',
      '<input data-percy-element-id=".+?" value="iframe with an input">',
      '</body></html>$'
    ].join('')));
  });

  it('does not serialize iframes with CORS', () => {
    expect($('#frame-external').attr('src')).toBe('https://example.com');
    expect($('#frame-external-fail').attr('src')).toBe('https://google.com');
    expect($('#frame-external').attr('srcdoc')).toBeUndefined();
    expect($('#frame-external-fail').attr('srcdoc')).toBeUndefined();
  });

  it('does not serialize iframes created by JS when JS is enabled', () => {
    $ = cheerio.load(serializeDOM({ enableJavaScript: true }));
    expect($('#frame-js').attr('src')).not.toBeUndefined();
    expect($('#frame-js').attr('srcdoc')).toBeUndefined();
    expect($('#frame-js-no-src').attr('srcdoc')).toBeUndefined();
  });

  it('removes iframes from the head element', () => {
    expect($('#frame-head')).toHaveLength(0);
  });

  it('removes inaccessible JS frames', () => {
    expect($('#frame-inject')).toHaveLength(0);
  });
});
