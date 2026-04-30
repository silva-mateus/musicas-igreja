'use client';

import React, { useMemo } from 'react';
import { parseChordProDocument, transposeChordProText, ChordProSection, ChordProLine } from '@/lib/chordpro';

interface ChordViewerProps {
  content: string;
  transposeAmount?: number;
  capoFret?: number;
  arrangementJson?: string;
  className?: string;
  fontSize?: number;
  showChords?: boolean;
  chordColor?: string;
  columnView?: boolean;
  columnCount?: number;
  hideHeaders?: boolean;
}

export function ChordViewer({
  content,
  transposeAmount = 0,
  capoFret = 0,
  arrangementJson,
  className = '',
  fontSize = 16,
  showChords = true,
  chordColor = 'oklch(0.62 0.18 50)',
  columnView = false,
  columnCount,
  hideHeaders = false,
}: ChordViewerProps) {
  
  // capoFret already subtracted in ChordPreview — don't double-count
  const totalSteps = transposeAmount;

  // Memoize the transposed content and parsing
  const document = useMemo(() => {
    const transposedText = transposeChordProText(content, totalSteps);
    return parseChordProDocument(transposedText);
  }, [content, totalSteps]);

  // Determine the sequence of sections to render
  const renderSections = useMemo(() => {
    if (!arrangementJson) return document.sections;

    try {
      const arrangement: string[] = JSON.parse(arrangementJson);
      if (!Array.isArray(arrangement) || arrangement.length === 0) return document.sections;

      const orderedSections: ChordProSection[] = [];
      for (const sectionId of arrangement) {
        // Find section by id (e.g. sec-1) or label (e.g. "Refrão")
        const sec = document.sections.find(s => s.id === sectionId || s.label === sectionId);
        if (sec) orderedSections.push({ ...sec, id: `${sec.id}-${orderedSections.length}` }); // unique ID for React keys
      }
      return orderedSections.length > 0 ? orderedSections : document.sections;
    } catch {
      return document.sections;
    }
  }, [document.sections, arrangementJson]);

  const renderLine = (line: ChordProLine, lineIdx: number) => {
    // Handle Directives
    if (line.nodes.length === 1 && line.nodes[0].type === 'directive') {
      const dir = line.nodes[0];
      if (dir.directiveName === 'title' || dir.directiveName === 't' || 
          dir.directiveName === 'subtitle' || dir.directiveName === 'st') {
        return null;
      }
      if (dir.directiveName === 'comment' || dir.directiveName === 'c') {
        return <div key={lineIdx} className="font-semibold mt-4 mb-1 text-[0.9em]" style={{ color: chordColor }}>{dir.value}</div>;
      }
      return null;
    }

    // Render Chords + Lyrics
    const hasChords = line.nodes.some(n => n.type === 'chord');
    
    if (!hasChords || !showChords) {
      const text = line.nodes
        .filter(n => n.type === 'text')
        .map(n => n.value)
        .join('');
      // Empty line
      if (!text.trim()) return <div key={lineIdx} className="h-[1em]" />;
      return <div key={lineIdx} className="min-h-[1.2em]">{text}</div>;
    }

    // Build chord-text segments: each segment has a chord (optional) and text
    const segments: Array<{ chord?: string; text: string }> = [];
    let currentChord: string | undefined = undefined;
    
    for (const node of line.nodes) {
      if (node.type === 'chord') {
        currentChord = node.value;
      } else if (node.type === 'text') {
        segments.push({ chord: currentChord, text: node.value });
        currentChord = undefined;
      }
    }
    // trailing chord with no text
    if (currentChord) {
      segments.push({ chord: currentChord, text: '\u00A0' });
    }

    return (
      <div key={lineIdx} className="flex flex-wrap items-end mb-1">
        {segments.map((seg, segIdx) => (
          <span key={segIdx} className="inline-flex flex-col align-bottom">
            <span
              className={`text-[0.85em] font-bold leading-tight min-h-[1.25em] ${seg.chord ? '' : 'invisible'}`}
              style={{ color: chordColor }}
            >
              {seg.chord || '\u00A0'}
            </span>
            <span className="whitespace-pre leading-normal">{seg.text}</span>
          </span>
        ))}
      </div>
    );
  };

  // Split sections into N balanced columns by line count
  const columnGroups = useMemo(() => {
    const n = columnCount && columnCount > 1 ? columnCount : 1;
    if (n === 1) return [renderSections];
    const weights = renderSections.map(s => Math.max(s.lines.length + (s.label ? 1 : 0), 1));
    const total = weights.reduce((a, b) => a + b, 0);
    const target = total / n;
    const cols: ChordProSection[][] = Array.from({ length: n }, () => []);
    let idx = 0;
    let acc = 0;
    for (let i = 0; i < renderSections.length; i++) {
      cols[idx].push(renderSections[i]);
      acc += weights[i];
      if (idx < n - 1 && acc >= target) { idx++; acc = 0; }
    }
    return cols.filter(c => c.length > 0);
  }, [renderSections, columnCount]);

  const renderSectionBlock = (section: ChordProSection) => (
    <div
      key={section.id}
      className={`mb-4 ${section.type === 'chorus' ? 'border-l-4 border-primary/30 pl-4 bg-muted/30 py-2 rounded-r-md' : ''}`}
    >
      {!hideHeaders && section.label && section.type !== 'other' && (
        <div
          className="font-semibold mb-2 text-[0.8em] uppercase tracking-wider"
          style={{ color: chordColor }}
        >
          {section.label}
        </div>
      )}
      {section.lines.map((line, idx) => renderLine(line, idx))}
    </div>
  );

  // Legacy column-view (Tailwind responsive) when columnCount not specified
  if (columnCount === undefined && columnView) {
    return (
      <div
        className={`font-sans leading-relaxed whitespace-pre-wrap ${className}`}
        style={{ fontSize: `${fontSize}px` }}
      >
        <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-0">
          {renderSections.map(s => (
            <div key={s.id} className="break-inside-avoid-column">
              {renderSectionBlock(s)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`font-sans leading-relaxed whitespace-pre-wrap ${className}`}
      style={{ fontSize: `${fontSize}px` }}
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${columnGroups.length}, 1fr)`,
          gap: '0 1.5rem',
        }}
      >
        {columnGroups.map((sectionsInCol, i) => (
          <div key={i} className="flex justify-center">
            <div className="space-y-0">
              {sectionsInCol.map(renderSectionBlock)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
