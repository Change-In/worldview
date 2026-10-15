/* Cloudflare Worker for the lesson address (NAV-187): serves only the lesson runner
   page, only inside Worldview pages. Every other path is 404, so nothing else (such
   as a service worker script) can ever be served from this address. */
import RUNNER from './runner.html';

const FRAME_ANCESTORS = "frame-ancestors https://worldview.cristianjperezb.workers.dev http://localhost:* http://127.0.0.1:*";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Not allowed', {status: 405});
    if (url.pathname !== '/') return new Response('Not found', {status: 404, headers: {'content-type': 'text/plain; charset=utf-8'}});
    return new Response(RUNNER, {headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': FRAME_ANCESTORS,
      'cache-control': 'public, max-age=300',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    }});
  },
};
