import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Upload from './components/Upload';
import DocumentList from './components/DocumentList';
import Chat from './components/Chat';
import TestPanel from './components/TestPanel';
import './App.css';

const API = 'http://localhost:8000';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'test'
  const [loading, setLoading] = useState(false);

  const fetchDocs = async () => {
    try {
      const { data } = await axios.get(`${API}/documents`);
      setDocuments(data.documents || []);
    } catch (e) { /* backend not ready yet */ }
  };

  useEffect(() => { fetchDocs(); }, []);

  const handleUpload = async (file) => {
    setLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await axios.post(`${API}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchDocs();
      return data;
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (docId) => {
    await axios.delete(`${API}/documents/${docId}`);
    if (selectedDoc?.doc_id === docId) setSelectedDoc(null);
    await fetchDocs();
  };

  return (
    <div className="app-layout">
      {/* ── Sidebar ───────────────────────────────────── */}
      <aside className="sidebar">
        <header className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">⬡</span>
            <span className="logo-text">DocMind</span>
          </div>
          <p className="logo-sub">RAG · Q&A · Test Engine</p>
        </header>

        <div className="sidebar-section">
          <p className="section-label">Upload Document</p>
          <Upload onUpload={handleUpload} loading={loading} />
        </div>

        <div className="sidebar-section sidebar-docs">
          <p className="section-label">Your Documents <span className="badge">{documents.length}</span></p>
          <DocumentList
            documents={documents}
            selected={selectedDoc}
            onSelect={setSelectedDoc}
            onDelete={handleDelete}
          />
        </div>

        <footer className="sidebar-footer">
          <p>Powered by Claude + Voyage</p>
        </footer>
      </aside>

      {/* ── Main ──────────────────────────────────────── */}
      <main className="main-content">
        {!selectedDoc ? (
          <EmptyState />
        ) : (
          <>
            <div className="main-header">
              <div className="doc-title-area">
                <span className="doc-icon">📄</span>
                <div>
                  <h1 className="doc-title">{selectedDoc.name}</h1>
                  <p className="doc-meta">{selectedDoc.chunks} chunks indexed</p>
                </div>
              </div>
              <div className="tab-bar">
                {['chat', 'test'].map(t => (
                  <button
                    key={t}
                    className={`tab-btn ${activeTab === t ? 'active' : ''}`}
                    onClick={() => setActiveTab(t)}
                  >
                    {t === 'chat' ? '💬 Ask Questions' : '📝 Take a Test'}
                  </button>
                ))}
              </div>
            </div>

            <div className="main-body">
              {activeTab === 'chat' ? (
                <Chat doc={selectedDoc} apiBase={API} />
              ) : (
                <TestPanel doc={selectedDoc} apiBase={API} />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state fade-in">
      <div className="empty-icon">⬡</div>
      <h2>Select a document to begin</h2>
      <p>Upload a PDF, DOCX, or TXT file, then select it to start asking questions or generate a test.</p>
      <div className="empty-features">
        {[
          ['💬', 'Ask anything', 'RAG-powered answers from your document'],
          ['📝', 'Auto-generated tests', 'Multiple choice questions from content'],
          ['🏆', 'Instant evaluation', 'Score + AI feedback on your answers'],
        ].map(([icon, title, desc]) => (
          <div key={title} className="feature-card">
            <span className="feature-icon">{icon}</span>
            <strong>{title}</strong>
            <p>{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
