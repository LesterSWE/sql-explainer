import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Tab = 'explain' | 'generate';

const EXAMPLE_QUERY = `SELECT u.name, COUNT(o.id) AS order_count, SUM(o.total) AS total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE o.created_at > '2024-01-01'
GROUP BY u.id
ORDER BY total_spent DESC;`;

const EXAMPLE_DESCRIPTION = `Get me a list of customers who placed more than 3 orders in the last 30 days, along with their total spend, sorted by highest spender first.`;

const markdownComponents = {
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-base font-semibold text-white mt-6 mb-3 first:mt-0 pb-2 border-b border-gray-700">
      {children}
    </h2>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-gray-300 text-sm leading-relaxed mb-3">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="text-gray-300 text-sm space-y-1.5 mb-3 pl-4">{children}</ul>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="flex gap-2 before:content-['•'] before:text-blue-400 before:flex-shrink-0">
      <span>{children}</span>
    </li>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <div className="relative group mt-3 mb-3">
      <pre className="bg-gray-800 rounded-lg p-4 overflow-x-auto text-sm">
        {children}
      </pre>
      <button
        onClick={() => {
          const el = document.querySelector('pre code');
          if (el) navigator.clipboard.writeText(el.textContent ?? '');
        }}
        className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        Copy
      </button>
    </div>
  ),
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const isBlock = !!className;
    return isBlock
      ? <code className="text-green-400 font-mono">{children}</code>
      : <code className="bg-gray-800 px-1.5 py-0.5 rounded text-green-400 font-mono text-xs">{children}</code>;
  },
};

async function streamRequest(
  url: string,
  body: object,
  onChunk: (text: string) => void
) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error('Request failed');

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) throw new Error('No response body');

  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') break;
      try {
        const { text } = JSON.parse(data);
        if (text) onChunk(text);
      } catch {
        // malformed chunk, skip
      }
    }
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('explain');

  // Explain tab state
  const [query, setQuery] = useState('');
  const [explainResult, setExplainResult] = useState('');

  // Generate tab state
  const [description, setDescription] = useState('');
  const [schema, setSchema] = useState('');
  const [generateResult, setGenerateResult] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const analyze = async () => {
    if (!query.trim() || isLoading) return;
    setExplainResult('');
    setError('');
    setIsLoading(true);
    try {
      await streamRequest('/api/explain', { query }, text =>
        setExplainResult(prev => prev + text)
      );
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const generate = async () => {
    if (!description.trim() || isLoading) return;
    setGenerateResult('');
    setError('');
    setIsLoading(true);
    try {
      await streamRequest('/api/generate', { description, schema }, text =>
        setGenerateResult(prev => prev + text)
      );
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-3xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-3">SQL Toolkit</h1>
          <p className="text-gray-400 text-lg">
            Explain existing queries or generate new ones from plain English.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 p-1 rounded-xl mb-8">
          <button
            onClick={() => { setTab('explain'); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              tab === 'explain'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Explain SQL
          </button>
          <button
            onClick={() => { setTab('generate'); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              tab === 'generate'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Write SQL
          </button>
        </div>

        {/* Explain Tab */}
        {tab === 'explain' && (
          <>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-400">Your SQL Query</label>
                <button
                  onClick={() => setQuery(EXAMPLE_QUERY)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Load example
                </button>
              </div>
              <textarea
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => handleKeyDown(e, analyze)}
                placeholder="SELECT * FROM users WHERE..."
                spellCheck={false}
                className="w-full h-48 px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl font-mono text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition"
              />
              <p className="text-xs text-gray-600 mt-1">Tip: Press ⌘ + Enter to analyze</p>
            </div>
            <button
              onClick={analyze}
              disabled={!query.trim() || isLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors mb-8"
            >
              {isLoading ? 'Analyzing...' : 'Analyze Query'}
            </button>
            {error && (
              <div className="mb-6 px-4 py-3 bg-red-900/30 border border-red-700 rounded-xl text-red-400 text-sm">{error}</div>
            )}
            {(explainResult || isLoading) && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {explainResult}
                </ReactMarkdown>
                {isLoading && <span className="inline-block w-0.5 h-4 bg-blue-400 animate-pulse ml-0.5 align-middle" />}
              </div>
            )}
          </>
        )}

        {/* Generate Tab */}
        {tab === 'generate' && (
          <>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-400">What do you want to query?</label>
                <button
                  onClick={() => setDescription(EXAMPLE_DESCRIPTION)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Load example
                </button>
              </div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={e => handleKeyDown(e, generate)}
                placeholder="Get me all users who signed up in the last 7 days..."
                spellCheck={false}
                className="w-full h-32 px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition"
              />
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-400 block mb-2">
                Table schema <span className="text-gray-600 font-normal">(optional — helps generate more accurate SQL)</span>
              </label>
              <textarea
                value={schema}
                onChange={e => setSchema(e.target.value)}
                placeholder={`users (id, name, email, created_at)\norders (id, user_id, total, created_at)`}
                spellCheck={false}
                className="w-full h-24 px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl font-mono text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition"
              />
              <p className="text-xs text-gray-600 mt-1">Tip: Press ⌘ + Enter to generate</p>
            </div>
            <button
              onClick={generate}
              disabled={!description.trim() || isLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors mb-8"
            >
              {isLoading ? 'Generating...' : 'Generate SQL'}
            </button>
            {error && (
              <div className="mb-6 px-4 py-3 bg-red-900/30 border border-red-700 rounded-xl text-red-400 text-sm">{error}</div>
            )}
            {(generateResult || isLoading) && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {generateResult}
                </ReactMarkdown>
                {isLoading && <span className="inline-block w-0.5 h-4 bg-blue-400 animate-pulse ml-0.5 align-middle" />}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 mt-10">
          Built by{' '}
          <a href="https://lesterdominguez.com" className="hover:text-gray-400 transition-colors">
            Lester Dominguez
          </a>{' '}
          · Powered by Claude
        </p>
      </div>
    </div>
  );
}
