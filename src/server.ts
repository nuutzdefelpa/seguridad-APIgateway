import cors from '@fastify/cors';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { env } from './lib/env.js';
import { proxyJson } from './lib/proxy.js';
import { sendResponse } from './lib/response.js';
import { getCurrentUserFromAccessToken, getTicketGroupId, hasPermission } from './lib/supabase.js';

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: Awaited<ReturnType<typeof getCurrentUserFromAccessToken>>;
  }
}

type GroupResolver = (request: FastifyRequest) => Promise<string | null> | string | null;

const app = Fastify({ logger: true });

async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return sendResponse(reply, 401, 'AUTH_HEADER_INVALID', { message: 'Missing Authorization header' });
  }

  const token = authorization.slice('Bearer '.length).trim();
  try {
    request.currentUser = await getCurrentUserFromAccessToken(token);
  } catch {
    return sendResponse(reply, 401, 'AUTH_TOKEN_INVALID', { message: 'Invalid or expired token' });
  }
}

function requirePermission(permissionCode: string, resolveGroupId?: GroupResolver) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authResult = await requireAuth(request, reply);
    if (reply.sent) {
      return authResult;
    }

    const groupId = resolveGroupId ? await resolveGroupId(request) : null;
    const allowed = await hasPermission(request.currentUser.profile.id, permissionCode, groupId);
    if (!allowed) {
      return sendResponse(reply, 403, 'AUTH_PERMISSION_DENIED', {
        message: `Missing permission ${permissionCode}`,
      });
    }
  };
}

async function authOnly(request: FastifyRequest, reply: FastifyReply) {
  return requireAuth(request, reply);
}

function queryString(request: FastifyRequest) {
  const query = request.query as Record<string, string | undefined>;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }

  const suffix = params.toString();
  return suffix ? `?${suffix}` : '';
}

async function bootstrap() {
  await app.register(cors, {
    origin: [env.frontendOrigin],
    credentials: true,
  });

  app.get('/health', async (_request, reply) => {
    return sendResponse(reply, 200, 'HEALTH_OK', { service: 'APIgateway', status: 'ok' });
  });

  app.post('/api/auth/login', async (request, reply) => {
    return proxyJson(request, reply, `${env.usersApiUrl}/api/auth/login`);
  });

  app.post('/api/auth/register', async (request, reply) => {
    return proxyJson(request, reply, `${env.usersApiUrl}/api/auth/register`);
  });

  app.get('/api/auth/me', { preHandler: authOnly }, async (request, reply) => {
    return proxyJson(request, reply, `${env.usersApiUrl}/api/auth/me`);
  });

  app.get('/api/users', { preHandler: requirePermission('users:view') }, async (request, reply) => {
    return proxyJson(request, reply, `${env.usersApiUrl}/api/users${queryString(request)}`);
  });

  app.get('/api/users/:userId', { preHandler: requirePermission('user:view') }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    return proxyJson(request, reply, `${env.usersApiUrl}/api/users/${userId}`);
  });

  app.post('/api/users', { preHandler: requirePermission('user:add') }, async (request, reply) => {
    return proxyJson(request, reply, `${env.usersApiUrl}/api/users`);
  });

  app.patch('/api/users/:userId', { preHandler: requirePermission('user:edit') }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    return proxyJson(request, reply, `${env.usersApiUrl}/api/users/${userId}`);
  });

  app.delete('/api/users/:userId', { preHandler: requirePermission('user:delete') }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    return proxyJson(request, reply, `${env.usersApiUrl}/api/users/${userId}`);
  });

  app.get('/api/groups', { preHandler: requirePermission('groups:view') }, async (request, reply) => {
    return proxyJson(request, reply, `${env.groupsApiUrl}/api/groups${queryString(request)}`);
  });

  app.get(
    '/api/groups/:groupId',
    { preHandler: requirePermission('group:view', request => (request.params as { groupId: string }).groupId) },
    async (request, reply) => {
      const { groupId } = request.params as { groupId: string };
      return proxyJson(request, reply, `${env.groupsApiUrl}/api/groups/${groupId}`);
    },
  );

  app.post('/api/groups', { preHandler: requirePermission('group:add') }, async (request, reply) => {
    return proxyJson(request, reply, `${env.groupsApiUrl}/api/groups`);
  });

  app.patch(
    '/api/groups/:groupId',
    { preHandler: requirePermission('group:edit', request => (request.params as { groupId: string }).groupId) },
    async (request, reply) => {
      const { groupId } = request.params as { groupId: string };
      return proxyJson(request, reply, `${env.groupsApiUrl}/api/groups/${groupId}`);
    },
  );

  app.delete(
    '/api/groups/:groupId',
    { preHandler: requirePermission('group:delete', request => (request.params as { groupId: string }).groupId) },
    async (request, reply) => {
      const { groupId } = request.params as { groupId: string };
      return proxyJson(request, reply, `${env.groupsApiUrl}/api/groups/${groupId}`);
    },
  );

  app.get(
    '/api/groups/:groupId/members',
    { preHandler: requirePermission('group:view', request => (request.params as { groupId: string }).groupId) },
    async (request, reply) => {
      const { groupId } = request.params as { groupId: string };
      return proxyJson(request, reply, `${env.groupsApiUrl}/api/groups/${groupId}/members`);
    },
  );

  app.post(
    '/api/groups/:groupId/members',
    { preHandler: requirePermission('group:edit', request => (request.params as { groupId: string }).groupId) },
    async (request, reply) => {
      const { groupId } = request.params as { groupId: string };
      return proxyJson(request, reply, `${env.groupsApiUrl}/api/groups/${groupId}/members`);
    },
  );

  app.delete(
    '/api/groups/:groupId/members/:userId',
    { preHandler: requirePermission('group:edit', request => (request.params as { groupId: string }).groupId) },
    async (request, reply) => {
      const { groupId, userId } = request.params as { groupId: string; userId: string };
      return proxyJson(request, reply, `${env.groupsApiUrl}/api/groups/${groupId}/members/${userId}`);
    },
  );

  app.get(
    '/api/tickets',
    {
      preHandler: requirePermission('ticket:view', request => {
        const query = request.query as { groupId?: string };
        return query.groupId ?? null;
      }),
    },
    async (request, reply) => {
      return proxyJson(request, reply, `${env.ticketsApiUrl}/api/tickets${queryString(request)}`);
    },
  );

  app.get(
    '/api/tickets/:ticketId',
    { preHandler: requirePermission('ticket:view', request => getTicketGroupId((request.params as { ticketId: string }).ticketId)) },
    async (request, reply) => {
      const { ticketId } = request.params as { ticketId: string };
      return proxyJson(request, reply, `${env.ticketsApiUrl}/api/tickets/${ticketId}`);
    },
  );

  app.post(
    '/api/tickets',
    { preHandler: requirePermission('ticket:add', request => (request.body as { groupId?: string }).groupId ?? null) },
    async (request, reply) => {
      return proxyJson(request, reply, `${env.ticketsApiUrl}/api/tickets`);
    },
  );

  app.patch(
    '/api/tickets/:ticketId',
    { preHandler: requirePermission('ticket:edit', request => getTicketGroupId((request.params as { ticketId: string }).ticketId)) },
    async (request, reply) => {
      const { ticketId } = request.params as { ticketId: string };
      return proxyJson(request, reply, `${env.ticketsApiUrl}/api/tickets/${ticketId}`);
    },
  );

  app.patch(
    '/api/tickets/:ticketId/state',
    { preHandler: requirePermission('ticket:edit_state', request => getTicketGroupId((request.params as { ticketId: string }).ticketId)) },
    async (request, reply) => {
      const { ticketId } = request.params as { ticketId: string };
      return proxyJson(request, reply, `${env.ticketsApiUrl}/api/tickets/${ticketId}/state`);
    },
  );

  app.delete(
    '/api/tickets/:ticketId',
    { preHandler: requirePermission('ticket:delete', request => getTicketGroupId((request.params as { ticketId: string }).ticketId)) },
    async (request, reply) => {
      const { ticketId } = request.params as { ticketId: string };
      return proxyJson(request, reply, `${env.ticketsApiUrl}/api/tickets/${ticketId}`);
    },
  );

  app.get(
    '/api/tickets/:ticketId/comments',
    { preHandler: requirePermission('ticket:view', request => getTicketGroupId((request.params as { ticketId: string }).ticketId)) },
    async (request, reply) => {
      const { ticketId } = request.params as { ticketId: string };
      return proxyJson(request, reply, `${env.ticketsApiUrl}/api/tickets/${ticketId}/comments`);
    },
  );

  app.post(
    '/api/tickets/:ticketId/comments',
    { preHandler: requirePermission('ticket:view', request => getTicketGroupId((request.params as { ticketId: string }).ticketId)) },
    async (request, reply) => {
      const { ticketId } = request.params as { ticketId: string };
      return proxyJson(request, reply, `${env.ticketsApiUrl}/api/tickets/${ticketId}/comments`);
    },
  );

  await app.listen({ port: env.port, host: '127.0.0.1' });
}

bootstrap().catch(error => {
  console.error(error);
  process.exit(1);
});
