import type { FastifyReply, FastifyRequest } from 'fastify';
import { sendResponse } from './response.js';

export async function proxyJson(
  request: FastifyRequest,
  reply: FastifyReply,
  targetUrl: string,
) {
  const method = request.method;
  const headers: Record<string, string> = {};

  if (request.headers.authorization) {
    headers.authorization = request.headers.authorization;
  }
  if (request.headers['content-type']) {
    headers['content-type'] = String(request.headers['content-type']);
  }

  const init: RequestInit = {
    method,
    headers,
  };

  if (method !== 'GET' && method !== 'HEAD' && request.body !== undefined) {
    init.body = JSON.stringify(request.body);
  }

  const response = await fetch(targetUrl, init);
  const text = await response.text();

  if (!text) {
    return sendResponse(reply, response.status, 'UPSTREAM_EMPTY', null);
  }

  try {
    const json = JSON.parse(text);
    return reply.status(response.status).send(json);
  } catch {
    return sendResponse(reply, 502, 'UPSTREAM_INVALID_JSON', { message: text });
  }
}
