import type { Handler } from '@netlify/functions';
import { listTemplates } from './utils/templates';

export const handler: Handler = async () => {
  try {
    const templates = await listTemplates();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templates }),
    };
  } catch (error) {
    console.error('Failed to list templates', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Unable to list templates' }),
    };
  }
};

