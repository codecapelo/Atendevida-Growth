import pino from 'pino';
import { env } from '#config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: ['*.caption', '*.copy_principal', '*.copy_curta'],
    censor: '[REDACTED]',
  },
  serializers: {
    post: (post) => {
      if (!post) return post;
      return {
        id: post.id,
        pilar: post.pilar,
        janela: post.janela,
        status: post.status,
        // Nunca logar caption completa — primeiros 50 chars apenas
        tema: post.tema?.slice(0, 50),
      };
    },
  },
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});
