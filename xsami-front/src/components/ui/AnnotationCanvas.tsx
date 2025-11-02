'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { AnnotationData, AnnotationTool, AnnotationPoint } from '@/types';

interface AnnotationCanvasProps {
  isAnnotating: boolean;
  tool: AnnotationTool;
  color: string;
  size: number;
  onAnnotationDraw: (annotation: AnnotationData) => void;
  remoteAnnotations: AnnotationData[];
  onClearAnnotations: () => void;
}

export default function AnnotationCanvas({
  isAnnotating,
  tool,
  color,
  size,
  onAnnotationDraw,
  remoteAnnotations,
  onClearAnnotations,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<AnnotationPoint[]>([]);

  // Initialize canvas context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Set canvas size to match container
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Redraw all annotations
  const redrawAnnotations = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all remote annotations
    remoteAnnotations.forEach((annotation) => {
      drawAnnotation(context, annotation);
    });
  }, [remoteAnnotations]);

  useEffect(() => {
    redrawAnnotations();
  }, [redrawAnnotations]);

  const drawAnnotation = (context: CanvasRenderingContext2D, annotation: AnnotationData) => {
    if (annotation.points.length === 0) return;

    context.strokeStyle = annotation.color;
    context.lineWidth = annotation.size;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    switch (annotation.type) {
      case 'pen':
        context.beginPath();
        context.moveTo(annotation.points[0].x, annotation.points[0].y);
        annotation.points.forEach((point) => {
          context.lineTo(point.x, point.y);
        });
        context.stroke();
        break;

      case 'line':
        if (annotation.points.length >= 2) {
          const start = annotation.points[0];
          const end = annotation.points[annotation.points.length - 1];
          context.beginPath();
          context.moveTo(start.x, start.y);
          context.lineTo(end.x, end.y);
          context.stroke();
        }
        break;

      case 'rectangle':
        if (annotation.points.length >= 2) {
          const start = annotation.points[0];
          const end = annotation.points[annotation.points.length - 1];
          const width = end.x - start.x;
          const height = end.y - start.y;
          context.strokeRect(start.x, start.y, width, height);
        }
        break;

      case 'circle':
        if (annotation.points.length >= 2) {
          const start = annotation.points[0];
          const end = annotation.points[annotation.points.length - 1];
          const radius = Math.sqrt(
            Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
          );
          context.beginPath();
          context.arc(start.x, start.y, radius, 0, 2 * Math.PI);
          context.stroke();
        }
        break;

      case 'eraser':
        context.globalCompositeOperation = 'destination-out';
        context.beginPath();
        context.moveTo(annotation.points[0].x, annotation.points[0].y);
        annotation.points.forEach((point) => {
          context.lineTo(point.x, point.y);
        });
        context.stroke();
        context.globalCompositeOperation = 'source-over';
        break;
    }
  };

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>): AnnotationPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isAnnotating) return;

    setIsDrawing(true);
    const point = getMousePos(e);
    setCurrentPath([point]);
    console.log('✏️ Started drawing with', tool, 'at', point);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isAnnotating || !isDrawing) return;

    const point = getMousePos(e);
    
    // For pen and eraser, add all points. For shapes, only keep start point and update end point
    let newPath: AnnotationPoint[];
    if (tool === 'pen' || tool === 'eraser') {
      newPath = [...currentPath, point];
    } else {
      // For line, rectangle, circle - only keep start point and current point
      newPath = [currentPath[0], point];
    }
    
    setCurrentPath(newPath);

    // Draw preview
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Redraw everything
    redrawAnnotations();

    // Draw current path preview
    const preview: AnnotationData = {
      type: tool,
      points: newPath,
      color,
      size,
      timestamp: Date.now(),
    };
    drawAnnotation(context, preview);
  };

  const handleMouseUp = () => {
    if (!isAnnotating || !isDrawing) return;

    setIsDrawing(false);

    if (currentPath.length > 0) {
      const annotation: AnnotationData = {
        type: tool,
        points: currentPath,
        color,
        size,
        timestamp: Date.now(),
      };

      console.log('✏️ Completed annotation:', annotation.type, 'with', annotation.points.length, 'points');
      onAnnotationDraw(annotation);
    }

    setCurrentPath([]);
  };

  const handleMouseLeave = () => {
    if (isDrawing) {
      handleMouseUp();
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full z-10 ${
        isAnnotating ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
      }`}
      onMouseDown={isAnnotating ? handleMouseDown : undefined}
      onMouseMove={isAnnotating ? handleMouseMove : undefined}
      onMouseUp={isAnnotating ? handleMouseUp : undefined}
      onMouseLeave={isAnnotating ? handleMouseLeave : undefined}
      style={{ touchAction: 'none' }}
    />
  );
}
