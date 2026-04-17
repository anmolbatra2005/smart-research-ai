import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import './Upload.css';

export default function Upload({ onUpload, loading }) {
  const [status, setStatus] = useState(null); // null | 'success' | 'error'
  const [message, setMessage] = useState('');

  const onDrop = useCallback(async (accepted) => {
    if (!accepted.length) return;
    const file = accepted[0];
    try {
      setStatus(null);
      const data = await onUpload(file);
      setStatus('success');
      setMessage(`✓ "${data.name}" — ${data.chunks} chunks`);
      setTimeout(() => setStatus(null), 4000);
    } catch (e) {
      setStatus('error');
      setMessage(e.response?.data?.detail || 'Upload failed');
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    multiple: false,
    disabled: loading,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'drag-active' : ''} ${loading ? 'disabled' : ''}`}
      >
        <input {...getInputProps()} />
        {loading ? (
          <div className="upload-loading">
            <div className="spinner spin" />
            <p>Processing…</p>
          </div>
        ) : isDragActive ? (
          <div className="upload-inner active">
            <span className="upload-icon">⬇</span>
            <p>Drop it!</p>
          </div>
        ) : (
          <div className="upload-inner">
            <span className="upload-icon">⬆</span>
            <p>Drop file or click</p>
            <span className="upload-types">PDF · DOCX · TXT</span>
          </div>
        )}
      </div>
      {status && (
        <p className={`upload-status ${status}`}>{message}</p>
      )}
    </div>
  );
}
