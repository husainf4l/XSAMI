'use client';

import { useState } from 'react';
import { Pen, Eraser, Minus, Square, Circle, Type, Trash2, X } from 'lucide-react';
import { AnnotationTool } from '@/types';
import Button from './Button';

interface AnnotationToolbarProps {
  onClose: () => void;
  tool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  color: string;
  onColorChange: (color: string) => void;
  size: number;
  onSizeChange: (size: number) => void;
  onClear: () => void;
}

const COLORS = [
  { name: 'Red', value: '#FF0000' },
  { name: 'Blue', value: '#0000FF' },
  { name: 'Green', value: '#00FF00' },
  { name: 'Yellow', value: '#FFFF00' },
  { name: 'Black', value: '#000000' },
  { name: 'White', value: '#FFFFFF' },
];

const TOOLS: { tool: AnnotationTool; icon: React.ReactNode; label: string }[] = [
  { tool: 'pen', icon: <Pen className="w-4 h-4" />, label: 'Pen' },
  { tool: 'eraser', icon: <Eraser className="w-4 h-4" />, label: 'Eraser' },
  { tool: 'line', icon: <Minus className="w-4 h-4" />, label: 'Line' },
  { tool: 'rectangle', icon: <Square className="w-4 h-4" />, label: 'Rectangle' },
  { tool: 'circle', icon: <Circle className="w-4 h-4" />, label: 'Circle' },
  { tool: 'text', icon: <Type className="w-4 h-4" />, label: 'Text' },
];

export default function AnnotationToolbar({
  onClose,
  tool,
  onToolChange,
  color,
  onColorChange,
  size,
  onSizeChange,
  onClear,
}: AnnotationToolbarProps) {
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-background-card border border-border rounded-xl shadow-2xl p-4 min-w-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Annotation Tools</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-background-hover rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-text-secondary" />
        </button>
      </div>

      {/* Tools */}
      <div className="space-y-4">
        {/* Tool Selection */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-2 block">Tool</label>
          <div className="grid grid-cols-3 gap-2">
            {TOOLS.map((t) => (
              <button
                key={t.tool}
                onClick={() => onToolChange(t.tool)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
                  tool === t.tool
                    ? 'bg-primary text-white'
                    : 'bg-background-secondary text-text-secondary hover:bg-background-hover'
                }`}
                title={t.label}
              >
                {t.icon}
                <span className="text-xs">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Color Selection */}
        {tool !== 'eraser' && (
          <div>
            <label className="text-xs font-medium text-text-secondary mb-2 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => onColorChange(c.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c.value
                      ? 'border-primary scale-110'
                      : 'border-border hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          </div>
        )}

        {/* Size Selection */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-2 block">
            Size: {size}px
          </label>
          <input
            type="range"
            min="1"
            max="20"
            value={size}
            onChange={(e) => onSizeChange(Number(e.target.value))}
            className="w-full h-2 bg-background-secondary rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>

        {/* Clear Button */}
        <Button
          onClick={onClear}
          variant="danger"
          size="sm"
          className="w-full gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Clear All Annotations
        </Button>
      </div>
    </div>
  );
}
