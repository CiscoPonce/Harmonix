import React from 'react';
import { VocabPopover } from './VocabPopover';

type Segment = string | React.ReactElement;

export interface MappedVocabItem {
  vocab_id: string;
  word: string;
  lemma?: string;
  definition: string;
  cefr_level: string;
  line_index: number;
  char_start: number;
  char_end?: number;
}

interface LyricLine {
  time: number;
  text: string;
}

interface LyricListProps {
  lines: LyricLine[];
  currentLineIndex: number;
  onLineClick: (timeSeconds: number) => void;
  mappedVocab?: MappedVocabItem[];
}

const LyricList: React.FC<LyricListProps> = ({ lines, currentLineIndex, onLineClick, mappedVocab = [] }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const activeLineRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentLineIndex]);

  const renderLineWithVocab = (lineText: string, lineIndex: number): Segment[] | string => {
    const lineVocab = mappedVocab
      .filter(v => v.line_index === lineIndex)
      .sort((a, b) => a.char_start - b.char_start);

    if (lineVocab.length === 0) return lineText;

    const segments: Segment[] = [];
    let lastIndex = 0;

    lineVocab.forEach((vocab, i) => {
      // Add text before the vocab word
      if (vocab.char_start > lastIndex) {
        segments.push(lineText.substring(lastIndex, vocab.char_start));
      }

      // Add the vocab word with popover. Use `char_end` when supplied by the
      // server (avoids recomputing length against Unicode that may fold
      // differently), otherwise fall back to `word.length`.
      const endOffset = typeof vocab.char_end === 'number'
        ? vocab.char_end
        : vocab.char_start + vocab.word.length;
      const vocabWord = lineText.substring(vocab.char_start, endOffset);
      segments.push(
        <VocabPopover
          key={`${vocab.vocab_id}-${i}`}
          word={vocab.word}
          lemma={vocab.lemma}
          definition={vocab.definition}
          cefrLevel={vocab.cefr_level}
        >
          <span className="text-yellow-400 underline decoration-dotted underline-offset-4 cursor-help hover:text-yellow-300 transition-colors">
            {vocabWord}
          </span>
        </VocabPopover>
      );

      lastIndex = endOffset;
    });

    // Add remaining text
    if (lastIndex < lineText.length) {
      segments.push(lineText.substring(lastIndex));
    }

    return segments;
  };

  return (
    <div 
      ref={containerRef}
      className="flex flex-col gap-6 overflow-y-auto h-full py-40 px-4 scroll-smooth"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <style jsx>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {lines.length === 0 ? (
        <div className="text-gray-500 text-center text-xl">Loading lyrics...</div>
      ) : (
        lines.map((line, index) => (
          <div
            key={`${line.time}-${index}`}
            ref={index === currentLineIndex ? activeLineRef : null}
            onClick={() => onLineClick(line.time / 1000)}
            className={`cursor-pointer transition-all duration-500 text-2xl md:text-4xl font-bold leading-tight ${
              index === currentLineIndex
                ? 'text-white opacity-100 scale-105'
                : 'text-zinc-700 opacity-40 hover:opacity-70 hover:text-zinc-400'
            }`}
          >
            {renderLineWithVocab(line.text, index)}
          </div>
        ))
      )}
    </div>
  );
};

export default LyricList;
