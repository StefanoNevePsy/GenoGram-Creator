import { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown, Heart, Users, Waypoints } from 'lucide-react';
import type { GenNode, RelationEdge, StickyNoteData } from '../types';
import { BASE_REL_CONFIG, RELATION_CATEGORIES } from '../config/relationships';
import { NODE_WIDTH, NODE_HEIGHT, NODE_RADIUS } from '../config/constants';
import { parseDate, calculateAge, calculateAgeAtDeath } from '../utils/dates';
import { getMarriageBarY } from '../utils/genogram';
import { getZigZagPath } from '../utils/geometry';

export const Legend = ({ x, y, darkMode, nodes, edges }: { x: number, y: number, darkMode: boolean, nodes: GenNode[], edges: RelationEdge[] }) => {
    const bg = darkMode ? '#1f2937' : '#ffffff';
    const text = darkMode ? '#f3f4f6' : '#1f2937';
    const border = darkMode ? '#374151' : '#e5e7eb';
    const subText = darkMode ? '#9ca3af' : '#6b7280';

    // 1. Calcola elementi unici
    const usedGenders = Array.from(new Set(nodes.map(n => n.gender))).sort();
    const hasDeceased = nodes.some(n => n.deceased);
    const hasIndex = nodes.some(n => n.indexPerson);
    const usedRelTypes = Array.from(new Set(edges.map(e => e.type))).sort();

    // 2. Layout Costanti
    const PADDING = 15;
    const ITEM_H = 24;
    const COL_WIDTH = 140; // Colonna più larga per leggibilità
    const TITLE_H = 30;

    // Calcola altezza necessaria
    const peopleCount = usedGenders.length + (hasDeceased ? 1 : 0) + (hasIndex ? 1 : 0);
    const relCount = usedRelTypes.length;

    // Logica layout: se tante relazioni, usa 2 colonne (Persone | Relazioni)
    // Se poche relazioni, usa una colonna unica verticale
    const useTwoCols = (peopleCount + relCount) > 8;
    const width = useTwoCols ? (COL_WIDTH * 2) + (PADDING * 3) : COL_WIDTH + (PADDING * 2);
    const height = TITLE_H + PADDING + (Math.max(peopleCount, useTwoCols ? relCount : peopleCount + relCount) * ITEM_H) + (useTwoCols ? 0 : 20);

    const renderGenderIcon = (g: string) => {
        const s = text; const f = 'none'; const w = 1.5;
        if (g === 'M') return <rect x="2" y="2" width="12" height="12" stroke={s} fill={f} strokeWidth={w} />;
        if (g === 'F') return <circle cx="8" cy="8" r="6" stroke={s} fill={f} strokeWidth={w} />;
        if (g === 'Pet') return <path d="M8 2 L14 8 L8 14 L2 8 Z" stroke={s} fill={f} strokeWidth={w} />;
        if (g === 'Pregnancy') return <path d="M8 2 L14 14 L2 14 Z" stroke={s} fill={f} strokeWidth={w} />;
        return <text x="8" y="12" textAnchor="middle" fontSize="10" fill={s} fontFamily="sans-serif">?</text>;
    };

    const renderRelLine = (type: string) => {
        return <LinePreview type={type} width={30} darkMode={darkMode} transparent={true} />;
    };

    return (
        <g transform={`translate(${x}, ${y})`}>
            {/* Box Sfondo */}
            <rect width={width} height={height} rx="8" fill={bg} stroke={border} strokeWidth="1" filter="drop-shadow(0 4px 6px rgb(0 0 0 / 0.1))" />

            {/* Header */}
            <text x={PADDING} y={22} fontWeight="bold" fill={text} fontSize="12" letterSpacing="0.5px" fontFamily="sans-serif">LEGENDA</text>
            <line x1={PADDING} y1={TITLE_H} x2={width - PADDING} y2={TITLE_H} stroke={border} strokeWidth="1" />

            {/* Contenuto */}
            <g transform={`translate(${PADDING}, ${TITLE_H + 15})`}>
                {/* Colonna Persone */}
                <g>
                    {peopleCount > 0 && <text x="0" y="-5" fontSize="9" fontWeight="bold" fill={subText} style={{ textTransform: 'uppercase' }} fontFamily="sans-serif">Persone</text>}
                    {usedGenders.map((g, i) => (
                        <g key={g} transform={`translate(0, ${i * ITEM_H})`}>
                            {renderGenderIcon(g)}
                            <text x="25" y="11" fill={text} fontSize="11" fontFamily="sans-serif">{g === 'M' ? 'Maschio' : g === 'F' ? 'Femmina' : g}</text>
                        </g>
                    ))}
                    {/* Index & Deceased sotto i generi */}
                    {hasDeceased && (
                        <g transform={`translate(0, ${usedGenders.length * ITEM_H})`}>
                            <rect x="2" y="2" width="12" height="12" stroke={text} fill="none" />
                            <line x1="2" y1="2" x2="14" y2="14" stroke={text} /><line x1="14" y1="2" x2="2" y2="14" stroke={text} />
                            <text x="25" y="11" fill={text} fontSize="11" fontFamily="sans-serif">Deceduto</text>
                        </g>
                    )}
                    {hasIndex && (
                        <g transform={`translate(0, ${(usedGenders.length + (hasDeceased ? 1 : 0)) * ITEM_H})`}>
                            <rect x="2" y="2" width="12" height="12" stroke={text} fill="none" />
                            <rect x="4" y="4" width="8" height="8" stroke={text} fill="none" />
                            <text x="25" y="11" fill={text} fontSize="11" fontFamily="sans-serif">Paz. Designato</text>
                        </g>
                    )}
                </g>

                {/* Colonna Relazioni (spostata a destra se useTwoCols) */}
                {usedRelTypes.length > 0 && (
                    <g transform={`translate(${useTwoCols ? COL_WIDTH + PADDING : 0}, ${useTwoCols ? 0 : (peopleCount * ITEM_H) + 15})`}>
                        <text x="0" y="-5" fontSize="9" fontWeight="bold" fill={subText} style={{ textTransform: 'uppercase' }} fontFamily="sans-serif">Relazioni</text>
                        {usedRelTypes.map((t, i) => {
                            const label = BASE_REL_CONFIG[t]?.label || 'Custom';
                            return (
                                <g key={t} transform={`translate(0, ${i * ITEM_H})`}>
                                    {renderRelLine(t)}
                                    <text x="35" y="11" fill={text} fontSize="11" fontFamily="sans-serif">{label}</text>
                                </g>
                            );
                        })}
                    </g>
                )}
            </g>
        </g>
    );
};

export const LinePreview = ({ type, width = 50, darkMode = false, transparent = false }: { type: string, width?: number, darkMode?: boolean, transparent?: boolean }) => {
    const config = BASE_REL_CONFIG[type] || BASE_REL_CONFIG['custom'];
    if (!config) return null;

    let color = config.color;
    if (color === '#000000' && darkMode) color = '#ffffff';
    if (config.renderType.includes('hostile') || config.renderType.includes('triple-zigzag') || config.lineStyle === 'zigzag-thick') color = '#ef4444';

    let actualEndX = width;
    const midX = width / 2;
    const midY = 7;

    const hasEndArrow = (config.renderType.includes('arrow') && !config.renderType.includes('center') && config.renderType !== 'double-arrow-inward') || config.renderType === 'triple-zigzag-center-arrow';
    let arrowOffset = 6;
    if (config.renderType === 'arrow-thick') arrowOffset = 8;
    if (hasEndArrow) actualEndX -= arrowOffset;

    let pathD = `M 0 ${midY} L ${actualEndX} ${midY}`;
    let strokeW = "2";
    if (config.lineStyle.startsWith('zigzag')) {
        let amp = width > 30 ? 3 : 2; let freq = width > 30 ? 8 : 6;
        if (config.lineStyle === 'zigzag-thick') { amp = width > 30 ? 4 : 3; freq = width > 30 ? 6 : 4; }
        pathD = getZigZagPath(0, midY, actualEndX, midY, amp, freq);
        strokeW = "1.5";
    }
    const strokeDash = config.lineStyle === 'dashed' ? '6,3' : (config.lineStyle === 'dotted' ? '2,2' : '');

    const decX = midX;
    const decY = midY;
    const stroke = color;
    const arrowTrans = `translate(${actualEndX}, ${midY})`;
    const centerArrowTrans = `translate(${midX}, ${midY})`;

    const Decorator = () => {
        // Migliore Amico: come in ConnectionLine (centrale dotted + 2 esterne solide)
        if (type === 'best-friend') return <g><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(0, 3)" fill="none" /><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(0, -3)" fill="none" /></g>;
        if (config.renderType === 'fusion' || config.renderType === 'triple') return <g><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(0, 3)" fill="none" /><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(0, -3)" fill="none" /></g>;
        if (config.renderType === 'fusion-hostile') return <g><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(0, 3)" fill="none" /><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(0, -3)" fill="none" /><path d={getZigZagPath(0, midY, actualEndX, midY)} stroke="red" strokeWidth={1.5} fill="none" /></g>;
        if (config.renderType === 'triple-zigzag') return <g><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(0, 3)" fill="none" /><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(0, -3)" fill="none" /><path d={getZigZagPath(0, midY, actualEndX, midY)} stroke="red" strokeWidth={1.5} fill="none" /></g>;
        if (config.renderType === 'double' || config.renderType === 'double-zigzag' || config.renderType === 'best-friend') return <path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(0, 3)" fill="none" strokeDasharray={strokeDash} />;

        if (config.renderType === 'oblique') return <line x1={decX + 3} y1={decY - 6} x2={decX - 3} y2={decY + 6} stroke={stroke} strokeWidth={2} />;
        if (config.renderType === 'oblique-double') return <g><line x1={decX + 1} y1={decY - 6} x2={decX - 5} y2={decY + 6} stroke={stroke} strokeWidth={2} /><line x1={decX + 5} y1={decY - 6} x2={decX - 1} y2={decY + 6} stroke={stroke} strokeWidth={2} /></g>;
        if (config.renderType === 'x-cross') return <g><line x1={decX + 4} y1={decY - 6} x2={decX - 4} y2={decY + 6} stroke={stroke} strokeWidth={2} /><line x1={decX - 4} y1={decY - 6} x2={decX + 4} y2={decY + 6} stroke={stroke} strokeWidth={2} /></g>;
        if (config.renderType === 'oblique-double-crossed') return <g><line x1={decX - 1} y1={decY - 6} x2={decX - 7} y2={decY + 6} stroke={stroke} strokeWidth={2} /><line x1={decX + 7} y1={decY - 6} x2={decX + 1} y2={decY + 6} stroke={stroke} strokeWidth={2} /><line x1={decX - 7} y1={decY - 6} x2={decX + 7} y2={decY + 6} stroke={stroke} strokeWidth={2} /></g>;

        if (config.renderType === 'cutoff-double') return <g><line x1={decX - 3} y1={decY - 6} x2={decX - 3} y2={decY + 6} stroke={stroke} strokeWidth={2} /><line x1={decX + 3} y1={decY - 6} x2={decX + 3} y2={decY + 6} stroke={stroke} strokeWidth={2} /></g>;
        if (config.renderType === 'cutoff') return <line x1={decX} y1={decY - 6} x2={decX} y2={decY + 6} stroke={stroke} strokeWidth={3} />;

        if (config.renderType === 'cutoff-repaired-circle') return <g><line x1={decX - 3} y1={decY - 6} x2={decX - 9} y2={decY + 6} stroke={stroke} strokeWidth={2} /><circle cx={decX} cy={decY} r={4} fill="none" stroke={stroke} strokeWidth={1.5} /><line x1={decX + 9} y1={decY - 6} x2={decX + 3} y2={decY + 6} stroke={stroke} strokeWidth={2} /></g>;
        if (config.renderType === 'dashed-inner') return <g><path d={pathD} stroke={stroke} strokeWidth={1.5} strokeDasharray="3,3" fill="none" transform={`translate(0, 4)`} /></g>;

        if (config.renderType === 'triple-zigzag-center-arrow') return <g><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(0, 3)" fill="none" /><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(0, -3)" fill="none" /><path d={getZigZagPath(0, midY, actualEndX, midY, 3, 8)} stroke="red" strokeWidth={1.5} fill="none" /><polygon points="-5,-4 5,0 -5,4" fill="red" transform={arrowTrans} /></g>;

        if (config.renderType === 'triangle-up-center') return <polygon points="-5,0 5,0 0,-8" fill={stroke} transform={centerArrowTrans} />;

        if (config.renderType === 'arrow-thick') return <polygon points="-6,-6 4,0 -6,6" fill={stroke} transform={arrowTrans} />;
        if (config.renderType === 'double-arrow-inward') {
            const x1 = actualEndX * 0.3; const x2 = actualEndX * 0.7;
            return <g>
                <polygon points="4,-4 -4,0 4,4" fill={stroke} transform={`translate(${x1}, ${midY})`} />
                <polygon points="-4,-4 4,0 -4,4" fill={stroke} transform={`translate(${x2}, ${midY})`} />
            </g>;
        }
        if (config.renderType === 'arrow-open-both') return <g><polyline points="-5,-4 5,0 -5,4" stroke={stroke} strokeWidth={1.5} fill="none" transform={arrowTrans} /><polyline points="5,-4 -5,0 5,4" stroke={stroke} strokeWidth={1.5} fill="none" transform={`translate(6, ${midY})`} /></g>;
        if (config.renderType === 'arrow-open-end') return <polyline points="-5,-4 5,0 -5,4" stroke={stroke} strokeWidth={1.5} fill="none" transform={arrowTrans} />;
        if (config.renderType === 'arrow-open-center') return <polyline points="-5,-4 5,0 -5,4" stroke={stroke} strokeWidth={1.5} fill="none" transform={centerArrowTrans} />;
        if (config.renderType.includes('arrow') && !config.renderType.includes('center')) return <g><polygon points="-5,-4 5,0 -5,4" fill={stroke} transform={arrowTrans} /></g>;

        if (config.renderType === 'arrow-x-center') return <g><polygon points="-5,-4 5,0 -5,4" fill={stroke} transform={arrowTrans} /><g transform={centerArrowTrans}><line x1="-4" y1="-4" x2="4" y2="4" stroke={stroke} strokeWidth={2} /><line x1="-4" y1="4" x2="4" y2="-4" stroke={stroke} strokeWidth={2} /></g></g>;
        if (config.renderType === 'arrow-box-center') return <g><polygon points="-5,-4 5,0 -5,4" fill={stroke} transform={arrowTrans} /><rect x="-4" y="-4" width="8" height="8" stroke={stroke} strokeWidth={2} fill="white" transform={centerArrowTrans} /></g>;
        if (config.renderType === 'arrow-diamond-center') return <g><polygon points="-5,-4 5,0 -5,4" fill={stroke} transform={arrowTrans} /><polygon points="0,-4 4,0 0,4 -4,0" stroke={stroke} strokeWidth={2} fill="white" transform={centerArrowTrans} /></g>;
        if (config.renderType === 'arrow-double-bar-center') return <g><polygon points="-5,-4 5,0 -5,4" fill={stroke} transform={arrowTrans} /><g transform={centerArrowTrans}><line x1="-2" y1="-6" x2="-2" y2="6" stroke={stroke} strokeWidth={2} /><line x1="2" y1="-6" x2="2" y2="6" stroke={stroke} strokeWidth={2} /></g></g>;

        return null;
    };

    const containerStyles = transparent ? "shrink-0 mr-2 overflow-visible" : "shrink-0 mr-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-100 dark:border-gray-600 overflow-visible";

    return (
        <svg width={width} height="14" className={containerStyles}>
            <path d={pathD} stroke={stroke} strokeWidth={strokeW} strokeDasharray={strokeDash} fill="none" />
            <Decorator />
        </svg>
    );
};


// ... RelationshipSelector (kept identical) ...
export const RelationshipSelector = ({ value, onChange, className }: { value: string, onChange: (val: string) => void, className?: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedConfig = BASE_REL_CONFIG[value] || BASE_REL_CONFIG['custom'] || { label: value, color: '#000', lineStyle: 'solid', renderType: 'standard' };
    return (
        <div className={`relative ${className}`}>
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-2 border rounded bg-white text-gray-900 dark:text-gray-100 dark:bg-gray-700 text-xs hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                <div className="flex items-center overflow-hidden"><LinePreview type={value} /><span className="truncate">{selectedConfig.label}</span></div><ChevronDown size={14} className="opacity-50 shrink-0 ml-1" />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded shadow-xl max-h-60 overflow-y-auto z-50 text-gray-900 dark:text-gray-100 text-left">
                    {Object.entries(RELATION_CATEGORIES).map(([category, keys]) => (
                        <div key={category}>
                            <div className="px-2 py-1 bg-gray-100 dark:bg-gray-900 text-[9px] font-bold uppercase text-gray-500 sticky top-0 border-b border-gray-200 dark:border-gray-700">{category}</div>
                            {keys.map((key: string) => {
                                const conf = BASE_REL_CONFIG[key];
                                if (!conf) return null;
                                return (
                                    <button key={key} onClick={() => { onChange(key); setIsOpen(false); }} className={`w-full flex items-center p-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/30 text-left border-b border-gray-50 dark:border-gray-700 ${value === key ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                        <LinePreview type={key} /><span>{conf.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                    <div className="p-1 sticky bottom-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700">
                        <button onClick={() => setIsOpen(false)} className="w-full py-1 text-center text-gray-400 hover:text-red-500 text-[10px]">Chiudi</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ... ConnectionLine, NodeShape, QuickRelMenu (Standard components) ...
export const ConnectionLine = ({ edge, start, end, isSelected, darkMode, customConfig, onSelect, onAddChild, isTargetGroup, tNode }: any) => {
    // Same content as previous, keeping logic for decorators
    let baseConfig = BASE_REL_CONFIG[edge.type];
    if (!baseConfig && customConfig) baseConfig = customConfig.config;
    if (!baseConfig) baseConfig = { label: '', color: '#000', lineStyle: 'solid', renderType: 'standard' };

    const finalColor = edge.color || baseConfig.color;
    const renderType = baseConfig.renderType;
    const stroke = isSelected ? '#3b82f6' : (darkMode && finalColor === '#000000' ? '#ffffff' : finalColor);
    const isStructural = ['marriage', 'secret', 'couple', 'divorce-commit', 'separation', 'separation-repaired', 'separation-cohab', 'divorce', 'divorce-repaired', 'cohabitation', 'affair', 're-marriage', 'engagement', 'one-night'].includes(edge.type);
    const marriageBarY = getMarriageBarY(start.y, end.y);
    let midX = (start.x + end.x) / 2;
    let midY = (start.y + end.y) / 2;
    if (isStructural) midY = marriageBarY;

    let pathD = '';

    const angle = isStructural ? 0 : Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;

    let borderDist = 20;
    if (tNode && !isTargetGroup) {
        const dx = start.x - end.x;
        const dy = start.y - end.y;
        let radius = 20;
        if (!['M', 'F', 'TransWoman', 'TransMan', 'NonBinary'].includes(tNode.gender)) radius = 15;

        if (tNode.gender !== 'F') {
            if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
                const theta = Math.atan2(dy, dx);
                const absCos = Math.abs(Math.cos(theta));
                const absSin = Math.abs(Math.sin(theta));
                radius = Math.min(radius / (absCos || 1), radius / (absSin || 1));
                if (radius > 30) radius = 30;
            }
        }
        borderDist = radius;
    }

    const tipOffset = renderType.includes('arrow-thick') ? 4 : 6;
    const arrowOffset = (isTargetGroup ? 0 : borderDist) + tipOffset;
    const arrowTrans = `translate(${end.x},${end.y}) rotate(${angle}) translate(-${arrowOffset},0)`;
    const centerArrowTrans = `translate(${midX},${midY}) rotate(${angle})`;

    let actualEndX = end.x;
    let actualEndY = end.y;

    const hasEndArrow = (renderType.includes('arrow') && !renderType.includes('center') && renderType !== 'double-arrow-inward') || renderType === 'triple-zigzag-center-arrow';
    if (hasEndArrow && !isStructural) {
        const baseOffset = arrowOffset + 4; // Use slightly smaller offset to avoid gap
        const rad = Math.atan2(end.y - start.y, end.x - start.x);
        actualEndX = end.x - Math.cos(rad) * baseOffset;
        actualEndY = end.y - Math.sin(rad) * baseOffset;
    }

    if (isStructural) pathD = `M ${start.x} ${start.y + NODE_RADIUS} L ${start.x} ${marriageBarY} L ${end.x} ${marriageBarY} L ${end.x} ${end.y + NODE_RADIUS}`;
    else if (edge.type.startsWith('child') || edge.type.startsWith('twin')) {
        if (edge.type.startsWith('twin')) pathD = `M ${start.x} ${start.y} L ${actualEndX} ${actualEndY}`;
        else pathD = `M ${start.x} ${start.y} L ${actualEndX} ${start.y} L ${actualEndX} ${actualEndY}`;
    } else if (baseConfig.lineStyle.startsWith('zigzag')) {
        let amp = 4; let freq = 12;
        if (baseConfig.lineStyle === 'zigzag-thick') { amp = 6; freq = 10; }
        pathD = getZigZagPath(start.x, start.y, actualEndX, actualEndY, amp, freq);
    }
    else pathD = `M ${start.x} ${start.y} Q ${midX} ${midY} ${actualEndX} ${actualEndY}`;

    const strokeDash = baseConfig.lineStyle === 'dashed' ? '8,4' : (baseConfig.lineStyle === 'dotted' ? '2,2' : '0');

    const Decorator = () => {
        let decX = midX; let decY = midY;

        // FIX: Rendering specifico per Migliore Amico (Dotted centrale + 2 Solide esterne)
        // Disegniamo le due linee esterne SENZA strokeDasharray così rimangono solide
        if (edge.type === 'best-friend') {
            return <g>
                <path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(3,3)" fill="none" />
                <path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(-3,-3)" fill="none" />
            </g>;
        }

        if (renderType === 'fusion' || renderType === 'triple') return <g><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(3,3)" fill="none" /><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(-3,-3)" fill="none" /></g>;

        // ... il resto del componente Decorator rimane uguale ...
        if (renderType === 'fusion-hostile') return <g><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(3,3)" fill="none" /><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(-3,-3)" fill="none" /><path d={getZigZagPath(start.x, start.y, actualEndX, actualEndY)} stroke="red" strokeWidth={1.5} fill="none" /></g>;
        if (renderType === 'triple-zigzag') return <g><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(3,3)" fill="none" /><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(-3,-3)" fill="none" /><path d={getZigZagPath(start.x, start.y, actualEndX, actualEndY)} stroke="red" strokeWidth={1.5} fill="none" /></g>;
        if (renderType === 'double' || renderType === 'double-zigzag' || renderType === 'best-friend') return <path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(3,3)" fill="none" strokeDasharray={strokeDash} />;

        // NUOVI SIMBOLI (CORREZIONE ANGOLO /)
        if (renderType === 'oblique') return <line x1={decX + 5} y1={decY - 10} x2={decX - 5} y2={decY + 10} stroke={stroke} strokeWidth={2} />;
        if (renderType === 'oblique-double') return <g><line x1={decX + 2} y1={decY - 10} x2={decX - 8} y2={decY + 10} stroke={stroke} strokeWidth={2} /><line x1={decX + 8} y1={decY - 10} x2={decX - 2} y2={decY + 10} stroke={stroke} strokeWidth={2} /></g>;
        if (renderType === 'x-cross') return <g><line x1={decX + 5} y1={decY - 10} x2={decX - 5} y2={decY + 10} stroke={stroke} strokeWidth={2} /><line x1={decX - 5} y1={decY - 10} x2={decX + 5} y2={decY + 10} stroke={stroke} strokeWidth={2} /></g>;
        if (renderType === 'oblique-double-crossed') return <g>
            <line x1={decX + 2} y1={decY - 10} x2={decX - 8} y2={decY + 10} stroke={stroke} strokeWidth={2} />
            <line x1={decX + 8} y1={decY - 10} x2={decX - 2} y2={decY + 10} stroke={stroke} strokeWidth={2} />
            <line x1={decX - 8} y1={decY - 10} x2={decX + 8} y2={decY + 10} stroke={stroke} strokeWidth={2} />
        </g>;

        if (renderType === 'cutoff-double') return <g><line x1={decX - 3} y1={decY - 10} x2={decX - 3} y2={decY + 10} stroke={stroke} strokeWidth={2} /><line x1={decX + 3} y1={decY - 10} x2={decX + 3} y2={decY + 10} stroke={stroke} strokeWidth={2} /></g>;
        if (renderType === 'cutoff') return <line x1={decX} y1={decY - 10} x2={decX} y2={decY + 10} stroke={stroke} strokeWidth={3} />;
        if (renderType === 'cutoff-repaired-circle') return <g><line x1={decX - 4} y1={decY - 10} x2={decX - 14} y2={decY + 10} stroke={stroke} strokeWidth={2} /><circle cx={decX} cy={decY} r={5} fill="none" stroke={stroke} strokeWidth={1.5} /><line x1={decX + 14} y1={decY - 10} x2={decX + 4} y2={decY + 10} stroke={stroke} strokeWidth={2} /></g>;

        if (renderType === 'dashed-inner') return <g><path d={pathD} stroke={stroke} strokeWidth={1.5} strokeDasharray="4,4" fill="none" transform={`translate(0, 6)`} /></g>;

        if (renderType === 'triple-zigzag-center') return <g><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(6,6)" fill="none" /><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(-6,-6)" fill="none" /><path d={getZigZagPath(start.x, start.y, actualEndX, actualEndY, 4, 12)} stroke="red" strokeWidth={1.5} fill="none" /></g>;

        if (renderType === 'triangle-up-center') return <polygon points="-6,0 6,0 0,-10" fill={stroke} transform={`translate(${midX},${midY})`} />;

        if (renderType === 'double-arrow-inward') {
            const dx = actualEndX - start.x; const dy = actualEndY - start.y;
            const ang = Math.atan2(dy, dx) * 180 / Math.PI;
            const x1 = start.x + dx * 0.33; const y1 = start.y + dy * 0.33;
            const x2 = start.x + dx * 0.67; const y2 = start.y + dy * 0.67;
            return <g>
                <polygon points="6,-6 -6,0 6,6" fill={stroke} transform={`translate(${x1},${y1}) rotate(${ang})`} />
                <polygon points="-6,-6 6,0 -6,6" fill={stroke} transform={`translate(${x2},${y2}) rotate(${ang})`} />
            </g>;
        }

        if (renderType === 'arrow-x-center') return <g><polygon points="-6,-6 6,0 -6,6" fill={stroke} transform={arrowTrans} /><g transform={centerArrowTrans}><line x1="-6" y1="-6" x2="6" y2="6" stroke={stroke} strokeWidth={2} /><line x1="-6" y1="6" x2="6" y2="-6" stroke={stroke} strokeWidth={2} /></g></g>;
        if (renderType === 'arrow-box-center') return <g><polygon points="-6,-6 6,0 -6,6" fill={stroke} transform={arrowTrans} /><rect x="-6" y="-6" width="12" height="12" stroke={stroke} strokeWidth={2} fill="white" transform={centerArrowTrans} /></g>;
        if (renderType === 'arrow-diamond-center') return <g><polygon points="-6,-6 6,0 -6,6" fill={stroke} transform={arrowTrans} /><polygon points="0,-6 6,0 0,6 -6,0" stroke={stroke} strokeWidth={2} fill="white" transform={centerArrowTrans} /></g>;
        if (renderType === 'arrow-double-bar-center') return <g><polygon points="-6,-6 6,0 -6,6" fill={stroke} transform={arrowTrans} /><g transform={centerArrowTrans}><line x1="-3" y1="-8" x2="-3" y2="8" stroke={stroke} strokeWidth={2} /><line x1="3" y1="-8" x2="3" y2="8" stroke={stroke} strokeWidth={2} /></g></g>;

        // I check specifici devono precedere quello generico, altrimenti sono irraggiungibili
        if (renderType === 'arrow-thick') return <polygon points="-8,-8 4,0 -8,8" fill={stroke} transform={arrowTrans} />;
        if (renderType === 'arrow-end') return <g><polygon points="-6,-6 6,0 -6,6" fill={stroke} transform={arrowTrans} /></g>;
        if (renderType === 'arrow-open-both') {
            const startTrans = `translate(${start.x},${start.y}) rotate(${angle + 180}) translate(-${arrowOffset},0)`;
            return <g><polyline points="-6,-6 6,0 -6,6" stroke={stroke} strokeWidth={2} fill="none" transform={arrowTrans} /><polyline points="-6,-6 6,0 -6,6" stroke={stroke} strokeWidth={2} fill="none" transform={startTrans} /></g>;
        }
        if (renderType === 'arrow-open-end') return <g><polyline points="-6,-6 6,0 -6,6" stroke={stroke} strokeWidth={2} fill="none" transform={arrowTrans} /></g>;
        if (renderType === 'arrow-open-center') return <g><polyline points="-6,-6 6,0 -6,6" stroke={stroke} strokeWidth={2} fill="none" transform={centerArrowTrans} /></g>;
        if (renderType.includes('arrow') && !renderType.includes('center') && !renderType.includes('thick')) return <g><polygon points="-6,-6 6,0 -6,6" fill={stroke} transform={arrowTrans} /></g>;
        if (renderType === 'triple-zigzag-center-arrow') return <g><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(6,6)" fill="none" /><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(-6,-6)" fill="none" /><path d={getZigZagPath(start.x, start.y, actualEndX, actualEndY, 4, 12)} stroke="red" strokeWidth={1.5} fill="none" /><polygon points="-6,-6 6,0 -6,6" fill="red" transform={arrowTrans} /></g>;

        return null;
    };
    const onAddChildH = (e: any) => {
        e.stopPropagation(); e.preventDefault();

        onAddChild(e, edge.id);
    };
    return <g className="group hover:opacity-80 cursor-pointer" onClick={onSelect}><path d={pathD} stroke="transparent" strokeWidth={20} fill="none" /><path d={pathD} stroke={stroke} strokeWidth={isSelected ? 3 : (baseConfig.lineStyle === 'zigzag-thick' ? 3 : 2)} strokeDasharray={strokeDash} fill="none" /><Decorator />{edge.label && <text x={midX} y={midY - 15} textAnchor="middle" fill={stroke} className="text-[10px] bg-white dark:bg-gray-800 px-1">{edge.label}</text>}{isSelected && isStructural && (<g transform={`translate(${midX}, ${marriageBarY})`} onPointerDown={onAddChildH} style={{ touchAction: 'none' }}><circle r={12} fill="#10b981" stroke="white" /><Plus size={12} x={-6} y={-6} stroke="white" strokeWidth={3} /><title>Aggiungi Figlio alla Coppia</title></g>)}</g>;
};

// --- COMPONENTE NODE SHAPE CON RINOMINA E COLORI ---
// --- SIMBOLO PERSONA CONDIVISO (genogramma + mappe Minuchin) ---
// Forma per genere, marcatori clinici, deceduto, paziente designato, istituzionalizzazione.
export const PersonSymbol = ({ node, darkMode, isSelected = false }: { node: GenNode, darkMode: boolean, isSelected?: boolean }) => {
    const strokeColor = darkMode ? '#ffffff' : '#000000';
    const strokeWidth = isSelected ? 3 : (node.indexPerson ? 3 : 1.5);
    const fill = isSelected ? (darkMode ? '#374151' : '#e0f2fe') : (darkMode ? '#1f2937' : '#ffffff');
    const w = NODE_WIDTH, h = NODE_HEIGHT;
    const r = NODE_RADIUS;

    let Shape;
    switch (node.gender) {
        case 'M': Shape = <rect x={0} y={0} width={w} height={h} stroke={strokeColor} strokeWidth={strokeWidth} fill={fill} />; break;
        case 'F': Shape = <circle cx={w / 2} cy={h / 2} r={w / 2} stroke={strokeColor} strokeWidth={strokeWidth} fill={fill} />; break;
        case 'TransWoman': Shape = <g><rect x={0} y={0} width={w} height={h} stroke={strokeColor} strokeWidth={strokeWidth} fill={fill} /><circle cx={w / 2} cy={h / 2} r={w / 3} stroke={strokeColor} strokeWidth={1} fill="none" /></g>; break;
        case 'TransMan': Shape = <g><circle cx={w / 2} cy={h / 2} r={w / 2} stroke={strokeColor} strokeWidth={strokeWidth} fill={fill} /><rect x={10} y={10} width={w - 20} height={h - 20} stroke={strokeColor} strokeWidth={1} fill="none" /></g>; break;
        case 'NonBinary': Shape = <polygon points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`} stroke={strokeColor} strokeWidth={strokeWidth} fill={fill} />; break;
        case 'Pet': Shape = <path d={`M${w / 2} 0 L${w} ${h / 2} L${w / 2} ${h} L0 ${h / 2} Z`} stroke={strokeColor} strokeWidth={strokeWidth} fill={fill} />; break;
        case 'Pregnancy': Shape = <path d={`M${w / 2} 0 L${w} ${h} L0 ${h} Z`} stroke={strokeColor} strokeWidth={strokeWidth} fill={fill} />; break;
        case 'Miscarriage': Shape = <circle cx={w / 2} cy={h / 2} r={8} fill={strokeColor} />; break;
        case 'Abortion': Shape = <g><path d={`M5 5 L${w - 5} ${h - 5} M${w - 5} 5 L5 ${h - 5}`} stroke={strokeColor} strokeWidth={2} /></g>; break;
        case 'Stillbirth': Shape = <g><rect x={0} y={0} width={w} height={h} stroke={strokeColor} strokeWidth={strokeWidth} fill={fill} /><path d={`M0 0 L${w} ${h} M${w} 0 L0 ${h}`} stroke={strokeColor} strokeWidth={1} /></g>; break;
        default: Shape = <rect x={5} y={5} width={w - 10} height={h - 10} stroke={strokeColor} strokeWidth={strokeWidth} fill={fill} strokeDasharray="4 2" />; break;
    }

    // FIX COLORI SIMBOLI CLINICI
    // Usiamo colori specifici e rimuoviamo l'opacity globale per renderli vividi
    const Issues = () => (
        <g className="pointer-events-none">
            {/* Abuso Droghe (arancio) e Abuso Alcol (ambra scuro): metà inferiore.
                Se presenti entrambi si dividono la metà in due bande orizzontali.
                Le bande sono clippate sulla forma del genere via clipPath. */}
            {(node.substanceAbuse || node.alcoholAbuse) && (() => {
                const clipId = `symclip-${node.id}`;
                const both = node.substanceAbuse && node.alcoholAbuse;
                const clipShape = node.gender === 'M'
                    ? <rect x={0} y={0} width={w} height={h} />
                    : (node.gender === 'F' ? <circle cx={r} cy={r} r={r} />
                        : <polygon points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`} />);
                return (
                    <g>
                        <clipPath id={clipId}>{clipShape}</clipPath>
                        <g clipPath={`url(#${clipId})`}>
                            {node.substanceAbuse && <rect x={0} y={h / 2} width={w} height={both ? h / 4 : h / 2} fill="#f97316" fillOpacity="0.8" stroke="none" />}
                            {node.alcoholAbuse && <rect x={0} y={both ? h * 0.75 : h / 2} width={w} height={both ? h / 4 : h / 2} fill="#92400e" fillOpacity="0.85" stroke="none" />}
                        </g>
                    </g>
                );
            })()}

            {/* Problema Psi: Viola (Left Half) */}
            {node.mentalIssue && (
                node.gender === 'M'
                    ? <rect x={0} y={0} width={w / 3} height={h} fill="#8b5cf6" fillOpacity="0.8" stroke="none" />
                    : <path d={`M ${r} 0 A ${r} ${r} 0 0 0 ${r} ${h} Z`} fill="#8b5cf6" fillOpacity="0.8" stroke="none" />
            )}

            {/* Dipendenza Comportamentale: Teal (righe orizzontali metà inferiore) */}
            {node.behavioralAddiction && (
                <g stroke="#14b8a6" strokeWidth={2.5} strokeOpacity="0.9">
                    <line x1={6} y1={h * 0.62} x2={w - 6} y2={h * 0.62} />
                    <line x1={7} y1={h * 0.75} x2={w - 7} y2={h * 0.75} />
                    <line x1={9} y1={h * 0.88} x2={w - 9} y2={h * 0.88} />
                </g>
            )}

            {/* Disturbo Alimentare: contorno interno tratteggiato */}
            {node.eatingDisorder && (
                node.gender === 'M'
                    ? <rect x={4} y={4} width={w - 8} height={h - 8} stroke="#e11d48" strokeWidth={1.5} strokeDasharray="3 2" fill="none" />
                    : <circle cx={w / 2} cy={h / 2} r={r - 4} stroke="#e11d48" strokeWidth={1.5} strokeDasharray="3 2" fill="none" />
            )}

            {/* Omosessualità: Rosa (Triangolo Inverso) */}
            {/* Aggiungiamo un stroke bianco/scuro per farlo risaltare se sovrapposto all'arancione */}
            {node.gayLesbian && (
                <path
                    d={`M ${w / 2 - 7} ${h - 12} L ${w / 2 + 7} ${h - 12} L ${w / 2} ${h} Z`}
                    fill="#ec4899"
                    stroke={fill}
                    strokeWidth={1}
                />
            )}
        </g>
    );

    // Istituzionalizzazione (carcere, comunità, RSA): parentesi quadre attorno al simbolo
    const InstitutionMark = node.institutionalized ? (
        <g stroke={strokeColor} strokeWidth={1.5} fill="none">
            <path d={`M -4 -4 L -8 -4 L -8 ${h + 4} L -4 ${h + 4}`} />
            <path d={`M ${w + 4} -4 L ${w + 8} -4 L ${w + 8} ${h + 4} L ${w + 4} ${h + 4}`} />
        </g>
    ) : null;

    const DeceasedMark = node.deceased ? <g stroke={strokeColor} strokeWidth={1.5}><line x1={0} y1={0} x2={w} y2={h} /><line x1={w} y1={0} x2={0} y2={h} /></g> : null;
    const IndexMark = node.indexPerson ? (node.gender === 'M' ? <rect x={6} y={6} width={w - 12} height={h - 12} stroke={strokeColor} strokeWidth={1.5} fill="none" /> : <circle cx={w / 2} cy={h / 2} r={w / 2 - 6} stroke={strokeColor} strokeWidth={1.5} fill="none" />) : null;

    // Immigrazione: freccetta con anno in alto a destra (convenzione genogrammi transculturali)
    const ImmigrationMark = node.immigrationYear ? (
        <g>
            <line x1={w + 3} y1={-6} x2={w + 11} y2={-14} stroke={strokeColor} strokeWidth={1.5} />
            <polygon points={`${w + 11},-14 ${w + 5},-13 ${w + 10},-8`} fill={strokeColor} />
            <text x={w + 13} y={-8} fontSize={7} fill={strokeColor}>{node.immigrationYear}</text>
        </g>
    ) : null;
    // PMA/Donazione: triangolino con "D" in alto a sinistra
    const DonorMark = node.donorConceived ? (
        <g>
            <polygon points={`-14,-4 -4,-4 -9,-14`} stroke={strokeColor} strokeWidth={1.2} fill="none" />
            <text x={-9} y={-6} fontSize={6.5} fill={strokeColor} textAnchor="middle" fontWeight={700}>D</text>
        </g>
    ) : null;

    return <g>{Shape}<Issues />{IndexMark}{DeceasedMark}{InstitutionMark}{ImmigrationMark}{DonorMark}</g>;
};

export const NodeShape = ({ node, isSelected, showLabelType, darkMode, onHandleDown, selectionMode, onRename }: any) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(node.name);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditName(node.name);
        setIsEditing(true);
    };

    const handleBlur = () => {
        setIsEditing(false);
        if (editName.trim() !== "" && editName !== node.name) {
            onRename(node.id, editName);
        }
    };



    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleBlur();
        if (e.key === 'Escape') setIsEditing(false);
    };

    const textColor = darkMode ? '#ffffff' : '#000000';
    const textBg = darkMode ? '#111827' : '#ffffff';
    const w = NODE_WIDTH, h = NODE_HEIGHT;
    const r = NODE_RADIUS;

    const hasBirthDate = node.birthDate && node.birthDate.trim() !== '';
    const showAge = node.showAge !== false; // Default true

    let internalLabel = '';
    if (hasBirthDate && showAge) {
        const hasDeathDate = node.deceased && node.deathDate && node.deathDate.trim() !== '';
        if (showLabelType === 'age') {
            // Per i deceduti con data di morte mostra l'età al decesso
            internalLabel = hasDeathDate ? calculateAgeAtDeath(node.birthDate, node.deathDate!) : calculateAge(node.birthDate);
        } else if (showLabelType === 'year') {
            const d = parseDate(node.birthDate);
            if (d) internalLabel = d.getFullYear().toString();
            // Convenzione genogramma: intervallo "nascita-morte" (es. 1950-2010)
            if (hasDeathDate) {
                const dd = parseDate(node.deathDate!);
                if (d && dd) internalLabel = `${d.getFullYear()}-${dd.getFullYear()}`;
            }
        } else if (showLabelType === 'date') {
            internalLabel = hasDeathDate ? `${node.birthDate} † ${node.deathDate}` : node.birthDate;
        }
    }

    const onH = (e: any, action: string) => {
        e.stopPropagation(); e.preventDefault();

        onHandleDown(e, action, node.id);
    };

    // FIX ALLINEAMENTO TESTO
    // Centriamo il testo verticalmente nel rect usando dominantBaseline="middle"
    const TextLabel = ({ y, text, size, bold }: { y: number, text: string, size: number, bold?: boolean }) => {
        if (!text) return null;
        // Stima larghezza basata su font size medio
        const charW = size * 0.65;
        const width = (text.length * charW) + 8;
        const height = size + 4; // Altezza box proporzionale

        return (
            <g pointerEvents="none">
                {/* Il rect è centrato verticalmente attorno a Y */}
                <rect x={w / 2 - width / 2} y={y - height / 2} width={width} height={height} fill={textBg} fillOpacity="0.9" rx="3" />
                {/* Il testo è centrato verticalmente su Y */}
                <text
                    x={w / 2}
                    y={y}
                    dominantBaseline="middle"
                    textAnchor="middle"
                    fill={textColor}
                    className={`text-[${size}px] font-sans ${bold ? 'font-bold' : ''} select-none`}
                    style={{ fontSize: size }} // Fallback style
                >
                    {text}
                </text>
            </g>
        )
    };

    return (
        <g transform={`translate(${node.x},${node.y})`} className="cursor-pointer group" onDoubleClick={handleDoubleClick}>
            <PersonSymbol node={node} darkMode={darkMode} isSelected={isSelected} />

            {isEditing ? (
                <foreignObject x={-40} y={-30} width={120} height={30}>
                    <input
                        ref={inputRef}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        style={{
                            width: '100%', height: '100%', border: '1px solid #3b82f6',
                            borderRadius: '4px', padding: '2px', fontSize: '12px',
                            textAlign: 'center', background: textBg, color: textColor,
                            outline: 'none'
                        }}
                    />
                </foreignObject>
            ) : (
                <TextLabel y={-10} text={node.name} size={11} bold />
            )}

            {/* Testo (Età, Data, Anno) posizionato all'interno del simbolo! */}
            {internalLabel && (
                <text
                    x={w / 2}
                    y={h / 2}
                    dominantBaseline="middle"
                    textAnchor="middle"
                    fill={textColor}
                    className="text-[11px] font-bold select-none pointer-events-none opacity-80"
                >
                    {internalLabel}
                </text>
            )}

            {node.label && <TextLabel y={h + 14} text={node.label} size={9} />}
            {node.profession && <TextLabel y={h + (node.label ? 26 : 14)} text={node.profession} size={8} />}

            {node.notes && node.notes.length > 0 && <circle cx={w + 5} cy={0} r={4} fill="#ef4444" stroke="white" strokeWidth={1} />}

            {isSelected && !selectionMode && !isEditing && (
                <g>
                    <g transform={`translate(${w + 20}, ${r})`} onPointerDown={(e) => onH(e, 'spouse')} className="cursor-crosshair hover:opacity-80" style={{ touchAction: 'none' }}>
                        <circle r={14} fill={darkMode ? '#333' : 'white'} stroke="#db2777" strokeWidth={2} />
                        <Heart size={14} x={-7} y={-7} fill="#db2777" stroke="#db2777" />
                        <title>Coniuge</title>
                    </g>
                    <g transform={`translate(${r}, ${h + 25})`} onPointerDown={(e) => onH(e, 'child')} className="cursor-crosshair hover:opacity-80" style={{ touchAction: 'none' }}>
                        <circle r={14} fill={darkMode ? '#333' : 'white'} stroke="#10b981" strokeWidth={2} />
                        <Plus size={14} x={-7} y={-7} color="#10b981" strokeWidth={3} />
                        <title>Figlio</title>
                    </g>
                    <g transform={`translate(${r}, -25)`} onPointerDown={(e) => onH(e, 'parents')} className="cursor-crosshair hover:opacity-80" style={{ touchAction: 'none' }}>
                        <circle r={14} fill={darkMode ? '#333' : 'white'} stroke="#8b5cf6" strokeWidth={2} />
                        <Users size={14} x={-7} y={-7} color="#8b5cf6" />
                        <title>Genitori</title>
                    </g>
                    <g transform={`translate(-20, ${r})`} onPointerDown={(e) => onH(e, 'link')} className="cursor-alias hover:opacity-80" style={{ touchAction: 'none' }}>
                        <rect x={-10} y={-10} width={20} height={20} rx={4} fill="#f59e0b" stroke="white" strokeWidth={1} />
                        <Waypoints size={12} x={-6} y={-6} color="white" />
                        <title>Relazione</title>
                    </g>
                </g>
            )}
        </g>
    );
};
// --- COMPONENTE TRANSFORMER AGGIORNATO (Spostamento Abilitato) ---
export const SelectionTransformer = ({ nodes, selectedIds, onHandleDown, onMove }: { nodes: GenNode[], selectedIds: string[], onHandleDown: (e: any, type: 'rotate' | 'scale') => void, onMove: (e: any) => void }) => {
    if (selectedIds.length < 2) return null;

    const selected = nodes.filter(n => selectedIds.includes(n.id));
    if (selected.length === 0) return null;

    const minX = Math.min(...selected.map(n => n.x));
    const maxX = Math.max(...selected.map(n => n.x + NODE_WIDTH));
    const minY = Math.min(...selected.map(n => n.y));
    const maxY = Math.max(...selected.map(n => n.y + NODE_HEIGHT));

    const padding = 20;
    const x = minX - padding;
    const y = minY - padding;
    const w = (maxX - minX) + padding * 2;
    const h = (maxY - minY) + padding * 2;

    return (
        <g pointerEvents="visible">
            {/* Box Tratteggiato: Ora ha fill quasi invisibile per catturare il click ovunque e permettere lo spostamento */}
            <rect
                x={x} y={y} width={w} height={h}
                fill="black" fillOpacity="0.01"
                stroke="#3b82f6" strokeWidth={1} strokeDasharray="5,5"
                className="cursor-move"
                style={{ touchAction: 'none' }}
                onPointerDown={onMove}
            />

            {/* Maniglia Rotazione (In alto al centro) */}
            <g transform={`translate(${x + w / 2}, ${y})`} className="cursor-grab active:cursor-grabbing" onPointerDown={(e) => {

                onHandleDown(e, 'rotate');
            }} style={{ touchAction: 'none' }}>
                <line x1={0} y1={0} x2={0} y2={-25} stroke="#3b82f6" strokeWidth={1} />
                <circle cx={0} cy={-25} r={5} fill="white" stroke="#3b82f6" strokeWidth={2} />
            </g>

            {/* Maniglia Scala (In basso a destra) */}
            <g transform={`translate(${x + w}, ${y + h})`} className="cursor-nwse-resize" onPointerDown={(e) => {

                onHandleDown(e, 'scale');
            }} style={{ touchAction: 'none' }}>
                <rect x={-6} y={-6} width={12} height={12} fill="white" stroke="#3b82f6" strokeWidth={2} />
            </g>
        </g>
    );
};

// --- COMPONENTE SELETTORE TEMA CON PREVIEW ---
export const StickyNoteShape = ({ note, isSelected, onPointerDown, onUpdate, zoom = 1 }: { note: StickyNoteData, isSelected: boolean, onPointerDown: (e: React.PointerEvent) => void, onUpdate: (n: StickyNoteData) => void, zoom?: number }) => {
    // Stato locale per gestire il resize
    const [resizing, setResizing] = useState<{ active: boolean, handle: string, startX: number, startY: number, startW: number, startH: number, pointerId?: number } | null>(null);

    // Gestori eventi resize globali
    useEffect(() => {
        if (!resizing || !resizing.active) return;

        const handlePointerMove = (e: PointerEvent) => {
            if (resizing.pointerId !== undefined && e.pointerId !== undefined && resizing.pointerId !== e.pointerId) return;

            // RIMOSSO: if (e.buttons === 0) { setResizing(null); return; } // Su touch e.buttons è sempre 0!
            const dx = (e.clientX - resizing.startX) / zoom;
            const dy = (e.clientY - resizing.startY) / zoom;
            let newW = resizing.startW;
            let newH = resizing.startH;

            // Calcolo dimensioni
            if (resizing.handle.includes('e')) newW = Math.max(30, resizing.startW + dx);
            if (resizing.handle.includes('s')) newH = Math.max(30, resizing.startH + dy);

            // Scaling visivo (zoom)
            // Nota: Se usi lo zoom nella canvas, dovresti dividere dx/dy per lo zoom level qui.
            // Per ora lasciamo raw pixel movement.

            onUpdate({ ...note, width: Math.round(newW), height: Math.round(newH) });
        };

        const handlePointerUp = (e: PointerEvent) => {
            if (resizing.pointerId !== undefined && e.pointerId !== undefined && resizing.pointerId !== e.pointerId) return;
            setResizing(null);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [resizing, note, onUpdate]);

    const startResize = (e: React.PointerEvent, handle: string) => {
        e.stopPropagation(); // FONDAMENTALE: Ferma il pan/box della canvas
        e.preventDefault();
        // Cattura il puntatore per fluidità (opzionale ma consigliato su touch)
        try { (e.target as Element).setPointerCapture(e.pointerId); } catch (err) { }

        setResizing({
            active: true, handle,
            startX: e.clientX, startY: e.clientY,
            startW: note.width, startH: note.height,
            pointerId: e.pointerId
        });
    };

    const ResizeHandle = ({ x, y, cursor, handle }: { x: number, y: number, cursor: string, handle: string }) => (
        <rect
            x={x - 8} y={y - 8} width={16} height={16} // Area di tocco aumentata per le dita
            fill="white" stroke="#3b82f6" strokeWidth={1}
            style={{ cursor, touchAction: 'none' }}
            onPointerDown={(e) => startResize(e, handle)} // Ura PointerDown
        />
    );

    const isLabel = note.variant === 'label';
    const borderRadius = isLabel ? 8 : 1;
    const showHelperBorder = isLabel && note.opacity === 0 && (isSelected || resizing?.active);

    return (
        <g
            transform={`translate(${note.x}, ${note.y})`}
            // Usa PointerDown invece di MouseDown
            onPointerDown={onPointerDown}
            className="cursor-move group"
        >
            {/* ... (Il resto del rendering SVG rimane identico: Ombra, Sfondo, Nastro) ... */}
            {!isLabel && (
                <rect x={3} y={3} width={note.width} height={note.height} fill="black" fillOpacity={0.15 * note.opacity} rx={2} pointerEvents="none" />
            )}

            <rect
                width={note.width} height={note.height}
                fill={note.color}
                fillOpacity={note.opacity}
                stroke={isSelected ? "#3b82f6" : (showHelperBorder ? "#ccc" : "rgba(0,0,0,0.05)")}
                strokeWidth={isSelected ? 2 : 1}
                strokeDasharray={showHelperBorder ? "4,2" : ""}
                rx={borderRadius}
                style={!isLabel ? { filter: `drop-shadow(0 1px 2px rgba(0,0,0,${0.1 * note.opacity}))` } : {}}
            />

            {!isLabel && (
                <rect x={0} y={0} width={note.width} height={20} fill="black" fillOpacity={0.05 * note.opacity} pointerEvents="none" />
            )}

            <foreignObject x={5} y={5} width={note.width - 10} height={note.height - 10} style={{ pointerEvents: 'none' }}>
                <div
                    // Stili inline (non Tailwind): l'SVG serializzato per gli export
                    // non ha il CSS della pagina, senza questi il testo sparisce/trabocca
                    style={{
                        width: '100%',
                        height: '100%',
                        whiteSpace: 'pre-wrap',
                        overflow: 'hidden',
                        lineHeight: 1.375,
                        fontFamily: note.fontFamily || 'sans-serif',
                        fontSize: '13px',
                        color: note.textColor || '#000',
                        opacity: note.opacity < 0.3 && note.textColor === '#000000' ? 1 : 0.9,
                        textAlign: isLabel ? 'center' : 'left',
                        alignItems: isLabel ? 'center' : 'flex-start',
                        justifyContent: 'center',
                        display: 'flex'
                    }}
                >
                    <span style={{ width: '100%' }}>{note.text || (isLabel ? "Etichetta" : "Nuova nota...")}</span>
                </div>
            </foreignObject>

            {isSelected && (
                <>
                    <ResizeHandle x={note.width} y={note.height / 2} cursor="ew-resize" handle="e" />
                    <ResizeHandle x={note.width / 2} y={note.height} cursor="ns-resize" handle="s" />
                    <ResizeHandle x={note.width} y={note.height} cursor="nwse-resize" handle="se" />
                </>
            )}
        </g>
    );
};

