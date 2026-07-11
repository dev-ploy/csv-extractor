'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  uploadCsv, mapHeaders, getPreview,
  importLeads, getSummary, getAiSummary,
} from '@/lib/api';
import type { UploadResponse, PreviewData, ImportResult, SessionSummary, AiSummary } from '@/types';
import UploadZone from '@/components/UploadZone';
import CSVPreview from '@/components/CSVPreview';
import MappingInfo from '@/components/MappingInfo';
import ImportSummary from '@/components/ImportSummary';
import AiSummaryCard from '@/components/AiSummaryCard';

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'mapping', label: 'AI Mapping' },
  { key: 'preview', label: 'Preview' },
  { key: 'importing', label: 'Import' },
  { key: 'done', label: 'Summary' },
];

const AI_MESSAGES = [
  'Contacting AI provider...',
  'Analyzing CSV headers...',
  'Comparing against schema fields...',
  'Generating field mappings...',
  'Validating mapping results...',
];

function HomePage() {
  const { user, token, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('upload');
  const [error, setError] = useState('');
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [strategy, setStrategy] = useState('');
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiMessageIdx, setAiMessageIdx] = useState(0);

  useEffect(() => {
    if (!authLoading && !token) {
      router.push('/login');
    }
  }, [authLoading, token, router]);

  useEffect(() => {
    if (step !== 'mapping' || !loading) return;
    const interval = setInterval(() => {
      setAiMessageIdx((prev) => (prev + 1) % AI_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [step, loading]);

  const handleUpload = useCallback(async (file: File, onProgress?: (pct: number) => void) => {
    setError('');
    setLoading(true);
    try {
      const res = await uploadCsv(file, onProgress);
      setUploadResult(res);
      setStep('mapping');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMap = useCallback(async () => {
    if (!uploadResult) return;
    setError('');
    setLoading(true);
    setAiMessageIdx(0);
    try {
      const res = await mapHeaders(uploadResult.id);
      setMapping(res.mapping);
      setStrategy(res.strategy);
      setStep('preview');
      const pv = await getPreview(uploadResult.id);
      setPreviewData(pv);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Mapping failed');
    } finally {
      setLoading(false);
    }
  }, [uploadResult]);

  const handleAiSummary = useCallback(async () => {
    if (!uploadResult) return;
    setAiSummaryLoading(true);
    try {
      const res = await getAiSummary(uploadResult.id);
      setAiSummary(res);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'AI summary failed');
    } finally {
      setAiSummaryLoading(false);
    }
  }, [uploadResult]);

  const handleImport = useCallback(async () => {
    if (!uploadResult) return;
    setError('');
    setStep('importing');
    setLoading(true);
    try {
      const res = await importLeads(uploadResult.id);
      setImportResult(res);
      const s = await getSummary(uploadResult.id);
      setSummary(s);
      setStep('done');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Import failed');
      setStep('preview');
    } finally {
      setLoading(false);
    }
  }, [uploadResult]);

  const handleReset = useCallback(() => {
    setStep('upload');
    setError('');
    setUploadResult(null);
    setMapping({});
    setStrategy('');
    setPreviewData(null);
    setImportResult(null);
    setSummary(null);
    setAiSummary(null);
  }, []);

  if (authLoading) {
    return (
      <div className="auth-page">
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  if (!user) return null;

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <>
      <header className="app-header">
        <h1>CSV <span>Extractor</span></h1>
        <div className="header-right">
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{user.name || user.email}</span>
          <span className="role-badge">{user.role}</span>
          <button className="logout-btn" onClick={logout}>Sign Out</button>
        </div>
      </header>

      <main>
        <div className="steps">
          {STEPS.map((s, i) => (
            <div key={s.key} className={`step ${i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''}`}>
              <span className="step-num">{i < stepIndex ? '✓' : i + 1}</span>
              {s.label}
            </div>
          ))}
        </div>

        {error && <div className="message error">{error}</div>}

        {step === 'upload' && (
          <>
            <h2 style={{ marginBottom: 16 }}>Upload CSV</h2>
            <UploadZone onUpload={handleUpload} />
            {loading && <div style={{ textAlign: 'center', marginTop: 16 }}><span className="spinner" /></div>}
          </>
        )}

        {step === 'mapping' && uploadResult && (
          <>
            <h2 style={{ marginBottom: 8 }}>{uploadResult.filename}</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
              {uploadResult.totalRows} rows detected · {uploadResult.preview.headers.length} columns
            </p>
            <CSVPreview
              headers={uploadResult.preview.headers}
              rows={uploadResult.preview.rows}
              totalRows={uploadResult.totalRows}
            />
            <div className="action-bar">
              <button className="btn btn-primary" onClick={handleMap} disabled={loading}>
                {loading ? <span className="spinner" /> : '🤖 Run AI Field Mapping'}
              </button>
              <button className="btn btn-outline" onClick={handleReset}>Cancel</button>
            </div>
            {loading && (
              <div className="ai-progress">
                <div className="ai-progress-bar" />
                <p className="ai-progress-text">{AI_MESSAGES[aiMessageIdx]}</p>
              </div>
            )}
          </>
        )}

        {step === 'preview' && previewData && (
          <>
            <h2 style={{ marginBottom: 8 }}>Mapped Preview</h2>
            <MappingInfo mapping={mapping} strategy={strategy} />
            <CSVPreview
              headers={previewData.headers}
              rows={previewData.rows.map((r) => r.raw)}
              totalRows={previewData.totalRows}
              mapping={mapping}
            />
            <div className="action-bar">
              <button className="btn btn-success" onClick={handleImport} disabled={loading}>
                {loading ? <span className="spinner" /> : '📥 Confirm & Import'}
              </button>
              <button className="btn btn-outline" onClick={handleReset}>Cancel</button>
            </div>
          </>
        )}

        {step === 'importing' && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
            <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>Importing leads...</p>
          </div>
        )}

        {step === 'done' && summary && (
          <>
            <h2 style={{ marginBottom: 16 }}>Import Complete</h2>
            <ImportSummary summary={summary} onReset={handleReset} />
            <div style={{ marginTop: 24 }}>
              {aiSummary ? (
                <AiSummaryCard data={aiSummary} />
              ) : (
                <div className="action-bar">
                  <button className="btn btn-primary" onClick={handleAiSummary} disabled={aiSummaryLoading}>
                    {aiSummaryLoading ? <span className="spinner" /> : '🤖 Generate AI Summary'}
                  </button>
                </div>
              )}
              {aiSummaryLoading && (
                <div className="ai-progress">
                  <div className="ai-progress-bar" />
                  <p className="ai-progress-text">Analyzing CSV data with AI...</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}

export default function Page() {
  return <HomePage />;
}
