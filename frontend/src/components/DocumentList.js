import React, { useState } from 'react';
import './DocumentList.css';

export default function DocumentList({ documents, selected, onSelect, onDelete }) {
  const [hoverId, setHoverId] = useState(null);

  if (!documents.length) {
    return <p className="no-docs">No documents yet.</p>;
  }

  return (
    <ul className="doc-list">
      {documents.map((doc) => {
        const isSelected = selected?.doc_id === doc.doc_id;
        return (
          <li
            key={doc.doc_id}
            className={`doc-item ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelect(doc)}
            onMouseEnter={() => setHoverId(doc.doc_id)}
            onMouseLeave={() => setHoverId(null)}
          >
            <span className="doc-item-icon">{getIcon(doc.name)}</span>
            <div className="doc-item-info">
              <span className="doc-item-name">{doc.name}</span>
              <span className="doc-item-meta">{doc.chunks} chunks</span>
            </div>
            {(hoverId === doc.doc_id || isSelected) && (
              <button
                className="doc-delete-btn"
                onClick={(e) => { e.stopPropagation(); onDelete(doc.doc_id); }}
                title="Delete"
              >
                ✕
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function getIcon(name = '') {
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'pdf') return '📕';
  if (ext === 'docx') return '📘';
  return '📄';
}
