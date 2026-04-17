import React, { useState } from 'react';
import axios from 'axios';
import './TestPanel.css';

const STATES = { IDLE: 'idle', LOADING: 'loading', TAKING: 'taking', DONE: 'done' };

export default function TestPanel({ doc, apiBase }) {
  const [state, setState] = useState(STATES.IDLE);
  const [numQ, setNumQ] = useState(5);
  const [questions, setQuestions] = useState([]);
  const [userAnswers, setUserAnswers] = useState({});
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const generateTest = async () => {
    setError('');
    setState(STATES.LOADING);
    try {
      const { data } = await axios.post(`${apiBase}/generate-test`, {
        doc_id: doc.doc_id,
        num_questions: numQ,
      });
      setQuestions(data.questions);
      setUserAnswers({});
      setResults(null);
      setState(STATES.TAKING);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to generate test');
      setState(STATES.IDLE);
    }
  };

  const submitTest = async () => {
    const answered = Object.keys(userAnswers).length;
    if (answered < questions.length) {
      setError(`Please answer all questions (${answered}/${questions.length} answered)`);
      return;
    }
    setError('');
    setState(STATES.LOADING);
    try {
      const { data } = await axios.post(`${apiBase}/evaluate`, {
        doc_id: doc.doc_id,
        questions: questions.map(q => q.question),
        answers: questions.map((_, i) => userAnswers[i] || ''),
        correct_answers: questions.map(q => q.correct_answer),
      });
      setResults(data);
      setState(STATES.DONE);
    } catch (e) {
      setError(e.response?.data?.detail || 'Evaluation failed');
      setState(STATES.TAKING);
    }
  };

  const reset = () => {
    setState(STATES.IDLE);
    setQuestions([]);
    setUserAnswers({});
    setResults(null);
    setError('');
  };

  // ── IDLE ──────────────────────────────────────────────────────────────────
  if (state === STATES.IDLE) {
    return (
      <div className="test-container fade-in">
        <div className="test-start-card">
          <div className="test-start-icon">📝</div>
          <h2>Generate a Test</h2>
          <p>Claude will read your document and create multiple-choice questions to test your understanding.</p>
          <div className="num-q-selector">
            <label>Number of questions</label>
            <div className="num-q-btns">
              {[3, 5, 7, 10].map(n => (
                <button
                  key={n}
                  className={`num-btn ${numQ === n ? 'active' : ''}`}
                  onClick={() => setNumQ(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="test-error">{error}</p>}
          <button className="btn-primary" onClick={generateTest}>
            Generate Test ✦
          </button>
        </div>
      </div>
    );
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (state === STATES.LOADING) {
    return (
      <div className="test-container fade-in">
        <div className="test-loading">
          <div className="loading-ring" />
          <p>{results ? 'Evaluating your answers…' : 'Generating questions…'}</p>
          <span>Claude is reading the document</span>
        </div>
      </div>
    );
  }

  // ── TAKING TEST ───────────────────────────────────────────────────────────
  if (state === STATES.TAKING) {
    const progress = Object.keys(userAnswers).length;
    const pct = Math.round((progress / questions.length) * 100);

    return (
      <div className="test-container">
        <div className="test-progress-bar">
          <div className="test-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="test-header">
          <span className="test-doc">{doc.name}</span>
          <span className="test-count">{progress}/{questions.length} answered</span>
        </div>

        <div className="questions-list">
          {questions.map((q, i) => (
            <div key={i} className={`question-card fade-in ${userAnswers[i] ? 'answered' : ''}`}>
              <div className="q-num">Q{i + 1}</div>
              <div className="q-body">
                <p className="q-text">{q.question}</p>
                <div className="q-options">
                  {q.options.map((opt) => (
                    <label key={opt} className={`option-label ${userAnswers[i] === opt ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name={`q-${i}`}
                        value={opt}
                        checked={userAnswers[i] === opt}
                        onChange={() => setUserAnswers(a => ({ ...a, [i]: opt }))}
                      />
                      <span className="option-marker">{opt[0]}</span>
                      <span className="option-text">{opt.slice(3)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="test-submit-area">
          {error && <p className="test-error">{error}</p>}
          <div className="test-actions">
            <button className="btn-ghost" onClick={reset}>← Regenerate</button>
            <button
              className={`btn-primary ${progress < questions.length ? 'dim' : ''}`}
              onClick={submitTest}
            >
              Submit Answers ({progress}/{questions.length})
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS ───────────────────────────────────────────────────────────────
  if (state === STATES.DONE && results) {
    const grade = results.percentage >= 80 ? 'A' : results.percentage >= 60 ? 'B' : results.percentage >= 40 ? 'C' : 'D';
    const gradeColor = { A: 'var(--success)', B: 'var(--accent3)', C: 'var(--accent2)', D: 'var(--danger)' }[grade];

    return (
      <div className="test-container">
        <div className="results-hero fade-in">
          <div className="score-ring" style={{ '--ring-color': gradeColor }}>
            <span className="score-pct">{results.percentage}%</span>
            <span className="score-grade" style={{ color: gradeColor }}>{grade}</span>
          </div>
          <div className="score-summary">
            <h2>Test Complete</h2>
            <p>{results.score} of {results.total} correct</p>
          </div>
        </div>

        <div className="feedback-box fade-in">
          <span className="feedback-label">🤖 AI Feedback</span>
          <p>{results.feedback}</p>
        </div>

        <div className="results-detail fade-in">
          {results.results.map((r, i) => (
            <div key={i} className={`result-item ${r.is_correct ? 'correct' : 'wrong'}`}>
              <div className="result-status">{r.is_correct ? '✓' : '✗'}</div>
              <div className="result-body">
                <p className="result-q">{r.question}</p>
                <div className="result-answers">
                  <span className={`result-ans ${r.is_correct ? 'correct' : 'wrong'}`}>
                    Your answer: {r.user_answer}
                  </span>
                  {!r.is_correct && (
                    <span className="result-ans correct-ans">
                      Correct: {r.correct_answer}
                    </span>
                  )}
                </div>
                {questions[i]?.explanation && (
                  <p className="result-explanation">💡 {questions[i].explanation}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="results-actions fade-in">
          <button className="btn-ghost" onClick={() => { setUserAnswers({}); setState(STATES.TAKING); }}>
            Retry Same Test
          </button>
          <button className="btn-primary" onClick={reset}>
            New Test ✦
          </button>
        </div>
      </div>
    );
  }

  return null;
}
