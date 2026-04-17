import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './Chat.css';

export default function Chat({ doc, apiBase }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    setMessages([]);
  }, [doc.doc_id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const { data } = await axios.post(`${apiBase}/ask`, {
        doc_id: doc.doc_id,
        question: q,
      });
      setMessages(m => [...m, {
        role: 'assistant',
        text: data.answer,
        sources: data.sources,
      }]);
    } catch (e) {
      setMessages(m => [...m, {
        role: 'assistant',
        text: '⚠ Error: ' + (e.response?.data?.detail || e.message),
        error: true,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-welcome fade-in">
            <p className="welcome-lead">Ask anything about this document.</p>
            <div className="suggestion-chips">
              {['Summarize this document', 'What are the key points?', 'List the main topics covered'].map(s => (
                <button key={s} className="chip" onClick={() => setInput(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role} fade-in`}>
            <div className="message-avatar">
              {msg.role === 'user' ? '👤' : '⬡'}
            </div>
            <div className="message-body">
              <div className={`message-bubble ${msg.error ? 'error' : ''}`}>
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
              {msg.sources?.length > 0 && (
                <details className="sources">
                  <summary>📎 {msg.sources.length} source chunk{msg.sources.length > 1 ? 's' : ''}</summary>
                  {msg.sources.map((s, j) => (
                    <div key={j} className="source-chunk">
                      <span className="source-num">{j + 1}</span>
                      <p>{s.length > 200 ? s.slice(0, 200) + '…' : s}</p>
                    </div>
                  ))}
                </details>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="message assistant fade-in">
            <div className="message-avatar">⬡</div>
            <div className="message-body">
              <div className="message-bubble thinking">
                <span className="dot" /><span className="dot" /><span className="dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask a question… (Enter to send)"
            rows={1}
            disabled={loading}
          />
          <button
            className={`send-btn ${loading ? 'disabled' : ''}`}
            onClick={send}
            disabled={loading || !input.trim()}
          >
            {loading ? <span className="spin" style={{display:'inline-block',width:14,height:14,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'white',borderRadius:'50%'}} /> : '↑'}
          </button>
        </div>
        <p className="input-hint">Shift+Enter for new line</p>
      </div>
    </div>
  );
}
