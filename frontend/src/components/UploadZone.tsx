'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface Props {
  onUpload: (file: File, onProgress?: (pct: number) => void) => Promise<void>;
}

export default function UploadZone({ onUpload }: Props) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback(async (accepted: File[]) => {
    if (accepted.length === 0) return;
    setLoading(true);
    setProgress(0);
    try {
      await onUpload(accepted[0], (pct) => setProgress(pct));
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
    maxFiles: 1,
    maxSize: 25 * 1024 * 1024,
    disabled: loading,
  });

  return (
    <div {...getRootProps()} className={`upload-zone ${isDragActive ? 'active' : ''} ${loading ? 'loading' : ''}`}>
      <input {...getInputProps()} />
      <div className="icon">{loading ? '⏳' : '📂'}</div>
      {loading ? (
        <>
          <p>Uploading and analyzing...</p>
          {progress > 0 && (
            <div className="progress-bar-wrapper">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
              <span className="progress-text">{progress}%</span>
            </div>
          )}
        </>
      ) : isDragActive ? (
        <p>Drop your CSV file here</p>
      ) : (
        <>
          <p><strong>Click to upload</strong> or drag and drop</p>
          <p className="hint">CSV files only · Max 25MB · Supports comma, semicolon, tab, pipe delimiters</p>
        </>
      )}
    </div>
  );
}
