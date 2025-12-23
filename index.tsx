
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

//Vibe coded by ammaar@google.com - Bản sắc Vibe nguyên bản & Việt hóa

import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

import { Artifact, Session, ComponentVariation } from './types';
import { INITIAL_PLACEHOLDERS } from './constants';
import { generateId } from './utils';

import NeuralMeshBackground from './components/DottedGlowBackground';
import ArtifactCard from './components/ArtifactCard';
import SideDrawer from './components/SideDrawer';
import { 
    ThinkingIcon, 
    CodeIcon, 
    SparklesIcon, 
    ArrowLeftIcon, 
    ArrowRightIcon, 
    ArrowUpIcon, 
    GridIcon,
    EditIcon
} from './components/Icons';

// Icons bổ sung
const WideToggleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
);

const SaveIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
);

const LibraryIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></svg>
);

const ExportIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);

const HistoryIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
);

interface SavedArtifact {
    id: string;
    prompt: string;
    styleName: string;
    html: string;
    date: number;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1500): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            const errorMsg = error?.message || "";
            const isQuotaError = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED');
            if (isQuotaError && i < maxRetries - 1) {
                const delay = initialDelay * Math.pow(2, i);
                await sleep(delay);
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(-1);
  const [focusedArtifactIndex, setFocusedArtifactIndex] = useState<number | null>(null);
  const [focusedSessionIndex, setFocusedSessionIndex] = useState<number | null>(null);
  const [isWide, setIsWide] = useState<boolean>(true);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [savedArtifacts, setSavedArtifacts] = useState<SavedArtifact[]>([]);
  const [numVariations, setNumVariations] = useState<number>(2); // Default to 2 UI cards
  
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholders, setPlaceholders] = useState<string[]>(INITIAL_PLACEHOLDERS);
  
  const [gridHeight, setGridHeight] = useState<number>(60);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  
  const [drawerState, setDrawerState] = useState<{
      isOpen: boolean;
      mode: 'code' | 'variations' | 'library' | 'history' | null;
      title: string;
      data: any; 
  }>({ isOpen: false, mode: null, title: '', data: null });

  // Fix: defined hasStarted as a derived value from sessions array length
  const hasStarted = sessions.length > 0;

  const inputRef = useRef<HTMLInputElement>(null);
  const appScrollRef = useRef<HTMLDivElement>(null);

  // Khôi phục dữ liệu từ LocalStorage
  useEffect(() => {
    const savedLib = localStorage.getItem('flash_ui_saved_components');
    if (savedLib) {
        try { setSavedArtifacts(JSON.parse(savedLib)); } catch (e) { console.error(e); }
    }
    const savedSessions = localStorage.getItem('flash_ui_all_sessions');
    if (savedSessions) {
        try { 
            const parsed = JSON.parse(savedSessions);
            setSessions(parsed);
            if (parsed.length > 0) setCurrentSessionIndex(parsed.length - 1);
        } catch (e) { console.error(e); }
    }
    inputRef.current?.focus();
  }, []);

  // Lưu sessions khi có thay đổi
  useEffect(() => {
    if (sessions.length > 0) {
        localStorage.setItem('flash_ui_all_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  useEffect(() => {
      const interval = setInterval(() => {
          setPlaceholderIndex(prev => (prev + 1) % placeholders.length);
      }, 5000);
      return () => clearInterval(interval);
  }, [placeholders.length]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const newHeight = (e.clientY / window.innerHeight) * 100;
    // Cho phép kéo dài lên đến 200vh
    if (newHeight > 20 && newHeight < 200) setGridHeight(newHeight);
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => setIsResizing(false), []);

  useEffect(() => {
    if (isResizing) {
        window.addEventListener('mousemove', handleResizeMove);
        window.addEventListener('mouseup', handleResizeEnd);
    } else {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
    }
    return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleOpenLibrary = useCallback(() => {
    setDrawerState({ isOpen: true, mode: 'library', title: 'Bộ sưu tập cá nhân', data: null });
  }, []);

  const handleSaveArtifact = useCallback(() => {
    const sIdx = focusedSessionIndex !== null ? focusedSessionIndex : currentSessionIndex;
    if (sIdx === -1 || focusedArtifactIndex === null) return;
    const session = sessions[sIdx];
    if (!session) return;
    const artifact = session.artifacts[focusedArtifactIndex];
    
    const newSave: SavedArtifact = {
        id: artifact.id,
        prompt: session.prompt,
        styleName: artifact.styleName,
        html: artifact.html,
        date: Date.now()
    };

    const updated = [newSave, ...savedArtifacts];
    setSavedArtifacts(updated);
    localStorage.setItem('flash_ui_saved_components', JSON.stringify(updated));
    alert("Đã lưu vào bộ sưu tập!");
  }, [sessions, currentSessionIndex, focusedSessionIndex, focusedArtifactIndex, savedArtifacts]);

  const handleExportImage = useCallback(() => {
    const sIdx = focusedSessionIndex !== null ? focusedSessionIndex : currentSessionIndex;
    if (sIdx === -1 || focusedArtifactIndex === null) return;
    const artifact = sessions[sIdx]?.artifacts[focusedArtifactIndex];
    if (!artifact) return;
    
    const win = window.open('', '_blank');
    if (win) {
        win.document.write(artifact.html);
        win.document.close();
        setTimeout(() => win.print(), 500);
    }
  }, [sessions, currentSessionIndex, focusedSessionIndex, focusedArtifactIndex]);

  const handleSendMessage = useCallback(async (manualPrompt?: string) => {
    const promptToUse = manualPrompt || inputValue;
    const trimmedInput = promptToUse.trim();
    if (!trimmedInput || isLoading) return;
    if (!manualPrompt) setInputValue('');

    setIsLoading(true);
    const sessionId = generateId();
    const placeholderArtifacts: Artifact[] = Array(numVariations).fill(null).map((_, i) => ({
        id: `${sessionId}_${i}`,
        styleName: 'Đang khởi tạo...',
        html: '',
        status: 'streaming',
    }));

    const newSession: Session = {
        id: sessionId,
        prompt: trimmedInput,
        timestamp: Date.now(),
        artifacts: placeholderArtifacts
    };

    setSessions(prev => [...prev, newSession]);
    const newIdx = sessions.length;
    setCurrentSessionIndex(newIdx); 
    setFocusedArtifactIndex(null); 
    setFocusedSessionIndex(null);

    // Cuộn xuống
    setTimeout(() => {
        if (appScrollRef.current) {
            appScrollRef.current.scrollTo({ top: appScrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, 100);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const stylePrompt = `Gợi ý ${numVariations} phong cách thiết kế UI nghệ thuật, phá cách cho yêu cầu: "${trimmedInput}". Trả về mảng JSON ${numVariations} chuỗi tiếng Việt tinh tế.`;
        
        const styleResponse = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: stylePrompt
        }));

        let generatedStyles: string[] = [];
        try {
            const jsonMatch = (styleResponse.text || '[]').match(/\[[\s\S]*\]/);
            if (jsonMatch) generatedStyles = JSON.parse(jsonMatch[0]);
        } catch (e) { 
            generatedStyles = ["Cao Cấp", "Vibe Nghệ Thuật", "Hiện Đại"].slice(0, numVariations);
        }

        generatedStyles = generatedStyles.slice(0, numVariations);
        setSessions(prev => prev.map(s => s.id === sessionId ? {
            ...s, artifacts: s.artifacts.map((art, i) => ({ ...art, styleName: generatedStyles[i] || 'Phong cách Vibe' }))
        } : s));

        const generateArtifact = async (artifact: Artifact, styleInstruction: string) => {
            try {
                const prompt = `Bạn là Senior Frontend Engineer. Hãy tạo UI component tuyệt đẹp, hoàn chỉnh cho: "${trimmedInput}". Phong cách: ${styleInstruction}. TOÀN BỘ VĂN BẢN TIẾNG VIỆT. ĐẢM BẢO UI KHÔNG CÓ THANH CUỘN BÊN TRONG CARD (Full Height). Trả về CHỈ mã HTML/CSS (trong thẻ <style>). KHÔNG Markdown.`;
                const responseStream = await callWithRetry<AsyncIterable<GenerateContentResponse>>(() => ai.models.generateContentStream({
                    model: 'gemini-3-flash-preview',
                    contents: prompt,
                }));

                let accumulatedHtml = '';
                for await (const chunk of responseStream) {
                    accumulatedHtml += chunk.text;
                    setSessions(prev => prev.map(sess => sess.id === sessionId ? {
                        ...sess, artifacts: sess.artifacts.map(art => 
                            art.id === artifact.id ? { ...art, html: accumulatedHtml } : art
                        )
                    } : sess));
                }
                
                let finalHtml = accumulatedHtml.trim().replace(/^```html\s*|```$/g, '');
                // Đảm bảo script thực thi và cho phép sửa nội dung
                finalHtml += `\n<script>document.body.contentEditable = 'true'; document.body.style.cursor = 'text'; document.body.style.minHeight = '100vh';</script>`;

                setSessions(prev => prev.map(sess => sess.id === sessionId ? {
                    ...sess, artifacts: sess.artifacts.map(art => 
                        art.id === artifact.id ? { ...art, html: finalHtml, status: 'complete' } : art
                    )
                } : sess));
            } catch (e: any) { 
                setSessions(prev => prev.map(sess => sess.id === sessionId ? {
                    ...sess, artifacts: sess.artifacts.map(art => art.id === artifact.id ? { ...art, status: 'error' } : art)
                } : sess));
            }
        };

        const generationTasks = [];
        for (let i = 0; i < placeholderArtifacts.length; i++) {
            generationTasks.push(generateArtifact(placeholderArtifacts[i], generatedStyles[i]));
            if (i < placeholderArtifacts.length - 1) await sleep(800);
        }
        await Promise.all(generationTasks);
    } catch (e: any) { 
        console.error(e);
    } finally { 
        setIsLoading(false); 
    }
  }, [inputValue, isLoading, sessions.length, numVariations]);

  const toggleNumVariations = () => {
    setNumVariations(prev => (prev === 3 ? 1 : prev + 1));
  };

  const handleEditArtifact = useCallback((sIndex: number, aIndex: number) => {
      setFocusedSessionIndex(sIndex);
      setFocusedArtifactIndex(aIndex);
      setIsEditMode(true);
  }, []);

  return (
    <>
        <SideDrawer isOpen={drawerState.isOpen} onClose={() => setDrawerState(s => ({...s, isOpen: false}))} title={drawerState.title}>
            {drawerState.mode === 'code' && <pre className="code-block"><code>{drawerState.data}</code></pre>}
            {drawerState.mode === 'library' && (
                <div className="library-grid">
                    {savedArtifacts.map((v) => (
                         <div key={v.id} className="sexy-card library-item" onClick={() => setDrawerState({ isOpen: true, mode: 'code', title: v.prompt, data: v.html })}>
                             <div className="sexy-preview"><iframe srcDoc={v.html} title={v.prompt} /></div>
                             <div className="sexy-label">{v.prompt}</div>
                         </div>
                    ))}
                </div>
            )}
            {drawerState.mode === 'history' && (
                <div className="history-list">
                    {sessions.map((s, idx) => (
                        <div key={s.id} className="history-item" onClick={() => {
                            setCurrentSessionIndex(idx);
                            setFocusedSessionIndex(null);
                            setFocusedArtifactIndex(null);
                            setDrawerState(d => ({ ...d, isOpen: false }));
                        }}>
                            <strong>{s.prompt}</strong>
                            <small>{new Date(s.timestamp).toLocaleString('vi-VN')}</small>
                        </div>
                    ))}
                </div>
            )}
        </SideDrawer>

        <div className="immersive-app" ref={appScrollRef}>
            <NeuralMeshBackground />

            <div className={`empty-state ${hasStarted ? 'fade-out' : ''}`}>
                <div className="empty-content"><h1>Flash UI</h1><p>Kiến tạo giao diện đỉnh cao trong tích tắc</p></div>
            </div>

            <div className="stage-container">
                {sessions.map((session, sIndex) => (
                    <div key={session.id} className="session-group">
                        <div className="grid-wrapper">
                            <div 
                                className={`artifact-grid ${isWide ? 'wide' : ''} grid-cols-${session.artifacts.length}`} 
                                style={{'--grid-height': `${gridHeight}vh`} as React.CSSProperties}
                            >
                                {session.artifacts.map((artifact, aIndex) => (
                                    <ArtifactCard 
                                        key={artifact.id} 
                                        artifact={artifact} 
                                        isFocused={focusedSessionIndex === sIndex && focusedArtifactIndex === aIndex} 
                                        onClick={() => {
                                            setFocusedSessionIndex(sIndex);
                                            setFocusedArtifactIndex(aIndex);
                                        }}
                                        onEdit={() => handleEditArtifact(sIndex, aIndex)}
                                        isEditMode={isEditMode && focusedSessionIndex === sIndex && focusedArtifactIndex === aIndex}
                                    />
                                ))}
                            </div>
                            {!isLoading && session.artifacts.every(a => a.status === 'complete' || a.status === 'error') && (
                                <div className="resize-handle" onMouseDown={handleResizeStart} title="Kéo để thay đổi chiều cao"></div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className={`action-bar ${hasStarted ? 'visible' : ''}`}>
                 <div className="action-buttons">
                    {focusedArtifactIndex !== null ? (
                        <>
                            <button onClick={() => { setFocusedArtifactIndex(null); setFocusedSessionIndex(null); setIsEditMode(false); }}><GridIcon /> Quay lại</button>
                            <button onClick={handleSaveArtifact}><SaveIcon /> Lưu Card</button>
                            <button onClick={() => setIsEditMode(!isEditMode)} style={{ color: isEditMode ? '#4ade80' : '#fff' }}>
                                <EditIcon /> {isEditMode ? 'Sửa: Bật' : 'Sửa nội dung'}
                            </button>
                            <button onClick={handleExportImage}><ExportIcon /> Xuất ảnh</button>
                            <button onClick={() => {
                                const sIdx = focusedSessionIndex !== null ? focusedSessionIndex : currentSessionIndex;
                                const art = sessions[sIdx]?.artifacts[focusedArtifactIndex!];
                                if(art) setDrawerState({ isOpen: true, mode: 'code', title: 'Mã nguồn', data: art.html });
                            }}><CodeIcon /> Code</button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setIsWide(!isWide)}><WideToggleIcon /> {isWide ? 'Độ rộng vừa' : 'Mở rộng màn hình'}</button>
                            <button onClick={() => setDrawerState({ isOpen: true, mode: 'history', title: 'Lịch sử kiến tạo', data: null })}><HistoryIcon /> Lịch sử</button>
                            <button onClick={toggleNumVariations}><SparklesIcon /> {`Tạo ${numVariations === 1 ? '2' : (numVariations === 2 ? '3' : '1')} UI`}</button>
                        </>
                    )}
                 </div>
            </div>

            <div className="floating-input-container">
                <div className="theme-deck always-visible">
                    {INITIAL_PLACEHOLDERS.map((theme, i) => (
                        <div key={i} className="theme-card-flip" onClick={() => handleSendMessage(theme)}>
                            <div className="theme-card-inner">
                                <div className={`theme-card-front theme-bg-${(i % 7) + 1}`}><SparklesIcon /><span>{theme.split(' ').slice(0, 2).join(' ')}...</span></div>
                                <div className="theme-card-back"><p>{theme}</p><small>Tạo ngay</small></div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className={`input-wrapper ${isLoading ? 'loading' : ''}`}>
                    {!isLoading ? (
                        <>
                            <button className="library-btn" onClick={handleOpenLibrary} title="Bộ sưu tập"><LibraryIcon /></button>
                            <input ref={inputRef} type="text" placeholder={placeholders[placeholderIndex]} value={inputValue} onChange={handleInputChange} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} />
                            <button className="send-button" onClick={() => handleSendMessage()} disabled={!inputValue.trim()}><ArrowUpIcon /></button>
                        </>
                    ) : (
                        <div className="input-generating-label" style={{ padding: '0 20px', display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                            <ThinkingIcon /><span style={{ color: '#fff', fontSize: '0.9rem', opacity: 0.8 }}>Đang kiến tạo cho bạn...</span>
                        </div>
                    )}
                </div>
            </div>

            <footer className="app-footer">
                Vibe coded by <a href="https://8a5.com" target="_blank" rel="noopener noreferrer">8a5.com</a> | <a href="https://discord.gg/79RHa6MVUU" target="_blank" rel="noopener noreferrer">Join Discord</a>
            </footer>
        </div>
    </>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
