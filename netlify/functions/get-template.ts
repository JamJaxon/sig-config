import type { Handler } from '@netlify/functions';
import { formatDisplayName, readTemplateContent } from './utils/templates';

export const handler: Handler = async (event) => {
  try {
    const slug = event.queryStringParameters?.slug;

    if (!slug) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Missing template slug' }),
      };
    }

    const { content, config } = await readTemplateContent(slug);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        displayName: formatDisplayName(slug),
        content,
        config,
      }),
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Template not found' }),
      };
    }

    console.error('Failed to load template', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Unable to load template' }),
    };
  }
};

