import { useState, useRef } from 'react';
import { uploadContribution } from '../../lib/api.js';

function FileItem({ file, status, progress }) {
  const isImage = file.type.startsWith('image/');
  const [previewUrl] = useState(() => (isImage ? URL.createObjectURL(file) : null));

  return (
    <div style={fi.wrap}>
      {isImage ? (
        <img src={previewUrl} alt={file.name} style={fi.thumb} />
      ) : (
        <div style={fi.videoThumb}>▶</div>
      )}
      <div style={fi.info}>
        <p style={fi.name} title={file.name}>{file.name}</p>
        <p style={fi.size}>{(file.size / 1024 / 1024).toFixed(1)} MB</p>
      </div>
      <div style={fi.status}>
        {status === 'pending' && <span style={fi.dot} />}
        {status === 'uploading' && (
          <div style={fi.bar}><div style={{ ...fi.barFill, width: `${progress}%` }} /></div>
        )}
        {status === 'done' && (
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="#5a8a6a" strokeWidth="1.5" strokeLinecap="round">
            <polyline points="2,9 6,13 16,5"/>
          </svg>
        )}
        {status === 'error' && <span style={{ color: 'var(--danger)', fontSize: 14 }}>✕</span>}
      </div>
    </div>
  );
}

const fi = {
  wrap: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '0.5px solid var(--border)', background: 'var(--paper-warm)' },
  thumb: { width: 36, height: 36, objectFit: 'cover', borderRadius: 3, flexShrink: 0 },
  videoThumb: { width: 36, height: 36, background: 'var(--ink)', borderRadius: 3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--paper)', fontSize: 14 },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 12, fontWeight: 400, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 },
  size: { fontSize: 11, fontWeight: 300, color: 'var(--ink-faint)', margin: '2px 0 0' },
  status: { width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dot: { display: 'block', width: 8, height: 8, borderRadius: '50%', background: 'var(--border)' },
  bar: { width: 32, height: 2, background: 'var(--paper-deep)', borderRadius: 1, overflow: 'hidden' },
  barFill: { height: '100%', background: 'var(--mv-accent)', transition: 'width .3s var(--ease-out)', borderRadius: 1 },
};

export default function ContributionUploadModal({ slug, storyToken, onClose }) {
  const [files, setFiles] = useState([]); // [{ file, status, progress }]
  const [uploaderName, setUploaderName] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | uploading | done
  const inputRef = useRef();

  function addFiles(newFiles) {
    const items = Array.from(newFiles).map((f) => ({ file: f, status: 'pending', progress: 0 }));
    setFiles((prev) => [...prev, ...items]);
  }

  function removeFile(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleDrop(e) {
    e.preventDefault();
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  async function submit(e) {
    e.preventDefault();
    if (!files.length) return;
    setPhase('uploading');

    for (let i = 0; i < files.length; i++) {
      const { file } = files[i];
      setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading', progress: 0 } : f));

      const formData = new FormData();
      formData.append('file', file);
      if (uploaderName.trim()) formData.append('uploader_name', uploaderName.trim());

      try {
        await uploadContribution(slug, formData, storyToken, (evt) => {
          if (evt.total) {
            const pct = Math.round((evt.loaded / evt.total) * 100);
            setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, progress: pct } : f));
          }
        });
        setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: 'done', progress: 100 } : f));
      } catch {
        setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: 'error' } : f));
      }
    }

    setPhase('done');
  }

  const doneCount = files.filter((f) => f.status === 'done').length;
  const allDone = phase === 'done';

  return (
    <div style={s.overlay} onClick={phase === 'idle' ? onClose : undefined}>
      <div style={s.card} onClick={(e) => e.stopPropagation()}>
        <h2 style={s.title}>Contribuir com fotos ou vídeos</h2>
        <p style={s.sub}>Os ficheiros serão revistos antes de aparecerem na história.</p>

        {!allDone ? (
          <form onSubmit={submit} style={s.form}>
            {/* Drop zone */}
            <div
              style={{ ...s.dropzone, minHeight: files.length ? 64 : 110 }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => phase === 'idle' && inputRef.current?.click()}
            >
              {files.length === 0 ? (
                <p style={s.dropHint}>
                  Clica ou arrasta ficheiros aqui<br />
                  <span style={{ fontSize: 12, color: 'var(--ink-faint)', fontWeight: 300 }}>Imagens e vídeos · vários de uma vez</span>
                </p>
              ) : (
                <p style={{ fontSize: 13, fontWeight: 300, color: 'var(--ink-muted)', padding: '12px 0' }}>
                  + Adicionar mais ficheiros
                </p>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div style={s.fileList}>
                {files.map(({ file, status, progress }, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <FileItem file={file} status={status} progress={progress} />
                    {phase === 'idle' && (
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        style={s.removeBtn}
                        title="Remover"
                      >✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <input
              style={s.input}
              type="text"
              placeholder="O teu nome (opcional)"
              value={uploaderName}
              maxLength={80}
              onChange={(e) => setUploaderName(e.target.value)}
              disabled={phase === 'uploading'}
            />

            <div style={s.actions}>
              <button type="button" style={s.btnSecondary} onClick={onClose} disabled={phase === 'uploading'}>
                Cancelar
              </button>
              <button type="submit" style={s.btn} disabled={!files.length || phase === 'uploading'}>
                {phase === 'uploading'
                  ? `A enviar… (${doneCount}/${files.length})`
                  : `Enviar ${files.length > 1 ? `${files.length} ficheiros` : 'ficheiro'}`}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'var(--success-pale)',
              border: '0.5px solid rgba(90,138,106,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px',
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#5a8a6a" strokeWidth="1.5" strokeLinecap="round">
                <polyline points="3,9 7,13 15,5"/>
              </svg>
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 400, color: 'var(--ink)', marginBottom: 4 }}>
              {doneCount} de {files.length} enviados com sucesso
            </p>
            <p style={{ fontSize: 12, fontWeight: 300, color: 'var(--ink-muted)', marginBottom: 16 }}>
              Serão revistos antes de aparecerem.
            </p>
            {files.some((f) => f.status === 'error') && (
              <p style={{ fontSize: 12, fontWeight: 300, color: 'var(--danger)', marginBottom: 12 }}>
                {files.filter((f) => f.status === 'error').length} ficheiro(s) falharam.
              </p>
            )}
            <div style={s.fileList}>
              {files.map(({ file, status, progress }, i) => (
                <FileItem key={i} file={file} status={status} progress={progress} />
              ))}
            </div>
            <div style={{ padding: '16px 16px 0', textAlign: 'center' }}>
              <button className="btn btn-primary" style={{ minWidth: 100 }} onClick={onClose}>Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(26,24,20,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 600, backdropFilter: 'blur(3px)',
  },
  card: {
    background: 'var(--paper)',
    borderRadius: 8,
    border: '0.5px solid var(--border)',
    width: 400, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 24px 64px rgba(26,24,20,0.18)',
    overflow: 'hidden',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 21, fontWeight: 500, color: 'var(--ink)',
    marginBottom: 6, textAlign: 'center',
    padding: '20px 24px 0',
  },
  sub: { fontSize: 12, fontWeight: 300, color: 'var(--ink-muted)', marginBottom: 16, textAlign: 'center', lineHeight: 1.6, padding: '0 24px' },
  form: { display: 'flex', flexDirection: 'column', gap: 10, padding: '0 16px 16px' },
  dropzone: {
    border: '0.5px dashed var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', background: 'var(--paper-warm)', textAlign: 'center',
  },
  dropHint: { fontSize: 13, fontWeight: 300, color: 'var(--ink-muted)', lineHeight: 1.7, padding: '16px 12px' },
  fileList: {
    maxHeight: 260, overflowY: 'auto',
    border: '0.5px solid var(--border)',
    borderRadius: 4, overflow: 'hidden',
  },
  input: {
    padding: '9px 13px',
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 13, fontWeight: 300,
    background: 'var(--paper-warm)',
    color: 'var(--ink-soft)',
  },
  actions: { display: 'flex', gap: 8 },
  btn: {
    flex: 1, padding: '10px 0',
    background: 'var(--ink)', color: 'var(--paper)',
    border: 'none', borderRadius: 'var(--radius-sm)',
    fontSize: 13, fontWeight: 400, cursor: 'pointer',
  },
  btnSecondary: {
    flex: 1, padding: '10px 0',
    background: 'var(--paper-warm)', color: 'var(--ink-soft)',
    border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)',
    fontSize: 13, fontWeight: 300, cursor: 'pointer',
  },
  removeBtn: { position: 'absolute', top: 8, right: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--ink-faint)', padding: '2px 4px' },
};
