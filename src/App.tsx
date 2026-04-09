import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const EXAMPLE_QUERY = `SELECT u.name, COUNT(o.id) AS order_count, SUM(o.total) AS total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE o.created_at > '2024-01-01'
GROUP BY u.id
ORDER BY total_spent DESC;`;

export default function App() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const analyze = async () => {
    if (!query.trim() || isLoading) return;
    setResult('');
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
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
            if (text) setResult(prev => prev + text);
          } catch {
            // malformed chunk, skip
          }
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      analyze();
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-3xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-3">SQL Explainer</h1>
          <p className="text-gray-400 text-lg">
            Paste a SQL query to get a plain-English explanation,
            optimization suggestions, and a rewritten version.
          </p>
        </div>

        {/* Input */}
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
            onKeyDown={handleKeyDown}
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

        {/* Error */}
        {error && (
          <div className="mb-6 px-4 py-3 bg-red-900/30 border border-red-700 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {(result || isLoading) && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: ({ children }) => (
                  <h2 className="text-base font-semibold text-white mt-6 mb-3 first:mt-0 pb-2 border-b border-gray-700">
                    {children}
                  </h2>
                ),
                p: ({ children }) => (
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="text-gray-300 text-sm space-y-1.5 mb-3 pl-4">{children}</ul>
                ),
                li: ({ children }) => (
                  <li className="flex gap-2 before:content-['•'] before:text-blue-400 before:flex-shrink-0">
                    <span>{children}</span>
                  </li>
                ),
                pre: ({ children }) => (
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
                code: ({ className, children }) => {
                  const isBlock = !!className;
                  return isBlock
                    ? <code className="text-green-400 font-mono">{children}</code>
                    : <code className="bg-gray-800 px-1.5 py-0.5 rounded text-green-400 font-mono text-xs">{children}</code>;
                },
              }}
            >
              {result}
            </ReactMarkdown>
            {isLoading && (
              <span className="inline-block w-0.5 h-4 bg-blue-400 animate-pulse ml-0.5 align-middle" />
            )}
          </div>
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
