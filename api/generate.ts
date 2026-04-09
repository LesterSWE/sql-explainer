import Anthropic from '@anthropic-ai/sdk';

export const config = { runtime: 'edge' };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert SQL engineer. When given a plain-English description of what data someone wants, write a SQL query that retrieves it.

Format your response with exactly two sections:

## Generated Query
Provide the SQL query in a \`\`\`sql code block. Write clean, readable SQL with proper formatting and aliasing.

## How It Works
Briefly explain what the query does and any assumptions you made — 2-4 sentences. If a schema was provided, note how you used it. If no schema was provided, note that table and column names are illustrative and should be adjusted to match the actual schema.`;

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  let description: string;
  let schema: string | undefined;
  try {
    const body = await req.json();
    description = body.description?.trim();
    schema = body.schema?.trim();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }

  if (!description) {
    return new Response(JSON.stringify({ error: 'description is required' }), { status: 400 });
  }

  const userMessage = schema
    ? `Write a SQL query for the following:\n\n${description}\n\nSchema:\n${schema}`
    : `Write a SQL query for the following:\n\n${description}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = client.messages.stream({
          model: 'claude-opus-4-6',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        });

        for await (const event of anthropicStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
            );
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: 'Generation failed' })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
