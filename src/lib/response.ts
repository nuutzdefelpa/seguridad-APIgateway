import type { FastifyReply } from 'fastify';

export function sendResponse(reply: FastifyReply, statusCode: number, intOpCode: string, data: unknown) {
  return reply.status(statusCode).send({
    statusCode,
    intOpCode,
    data,
  });
}
