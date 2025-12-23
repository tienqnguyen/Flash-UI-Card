
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState } from 'react';
import { Artifact } from '../types';
import { ShareIcon, CheckIcon, EditIcon } from './Icons';

interface ArtifactCardProps {
    artifact: Artifact;
    isFocused: boolean;
    onClick: () => void;
    onEdit?: (e: React.MouseEvent) => void;
    isEditMode?: boolean;
}

const ArtifactCard = React.memo(({ 
    artifact, 
    isFocused, 
    onClick,
    onEdit,
    isEditMode = false
}: ArtifactCardProps) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const codeRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.unobserve(entry.target);
                }
            },
            { threshold: 0.1 }
        );
        if (cardRef.current) observer.observe(cardRef.current);
        return () => observer.disconnect();
    }, []);

    // Sync edit mode to iframe
    useEffect(() => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
            if (doc && doc.body) {
                doc.body.contentEditable = isEditMode ? 'true' : 'false';
                doc.body.style.cursor = isEditMode ? 'text' : 'default';
            }
        }
    }, [isEditMode, artifact.html]);

    // Tự động cuộn code overlay khi đang streaming
    useEffect(() => {
        if (codeRef.current) {
            codeRef.current.scrollTop = codeRef.current.scrollHeight;
        }
    }, [artifact.html]);

    const handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!artifact.html) return;
        try {
            await navigator.clipboard.writeText(artifact.html);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code: ', err);
        }
    };

    const isStreaming = artifact.status === 'streaming';

    return (
        <div 
            ref={cardRef}
            className={`artifact-card ${isFocused ? 'focused' : ''} ${isStreaming ? 'generating' : ''} ${isVisible ? 'visible' : ''}`}
            onClick={onClick}
        >
            <div className="artifact-header">
                <div className="header-left">
                    <span className={`status-indicator ${isStreaming ? 'pulse' : ''}`}></span>
                    <span className="artifact-style-tag">{artifact.styleName}</span>
                </div>
                {!isStreaming && artifact.status === 'complete' && (
                    <div className="header-actions">
                        <button 
                            className={`share-card-btn ${copied ? 'copied' : ''}`} 
                            onClick={handleShare}
                            title="Sao chép mã nguồn"
                        >
                            {copied ? <CheckIcon /> : <ShareIcon />}
                            <span>{copied ? 'Đã chép' : 'Chia sẻ'}</span>
                        </button>
                        <button 
                            className={`edit-card-btn ${isEditMode ? 'active' : ''}`} 
                            onClick={(e) => { e.stopPropagation(); onEdit?.(e); }}
                            title="Chỉnh sửa nội dung"
                        >
                            <EditIcon />
                            <span>Sửa UI</span>
                        </button>
                    </div>
                )}
            </div>
            <div className="artifact-card-inner">
                {/* Code Overlay - Hiệu ứng mã chạy khi đang tạo */}
                {isStreaming && (
                    <div className="coding-overlay" ref={codeRef}>
                        <div className="code-stream-content">
                            <code>{artifact.html}</code>
                        </div>
                    </div>
                )}
                
                <iframe 
                    ref={iframeRef}
                    srcDoc={artifact.html} 
                    title={artifact.id} 
                    sandbox="allow-scripts allow-forms allow-modals allow-popups allow-presentation allow-same-origin"
                    className="artifact-iframe"
                />
            </div>
        </div>
    );
});

export default ArtifactCard;
