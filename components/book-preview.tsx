"use client";

import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocumentProxy } from "pdfjs-dist";
import { Skeleton } from "@/components/ui/skeleton";

const workerSrc = typeof window !== 'undefined'
  ? `${window.location.origin}/pdf.worker.min.js`
  : '/pdf.worker.min.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface BookPreviewProps {
  url: string;
  onError?: (error: Error) => void;
}

interface LoadProgress {
  loaded: number;
  total: number;
}

export function BookPreview({ url, onError }: BookPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [renderedPages, setRenderedPages] = useState<HTMLCanvasElement[]>([]);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    async function loadPDF() {
      try {
        setLoading(true);
        setRenderedPages([]);
        
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);

        const newRenderedPages = [];
        for (let pageNum = 9; pageNum <= 18; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.2 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          
          if (!context) continue;

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.marginBottom = '20px';

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          newRenderedPages.push(canvas);
        }
        setRenderedPages(newRenderedPages);
      } catch (error) {
        console.error('Error loading PDF:', error);
        onError?.(error as Error);
      } finally {
        setLoading(false);
      }
    }

    if (url) {
      loadPDF();
    }

    return () => {
      // Clean up canvas elements
      pageRefs.current.forEach(ref => {
        if (ref && ref.firstChild) {
          ref.removeChild(ref.firstChild);
        }
      });
      if (pdfDoc) {
        pdfDoc.destroy();
      }
    };
  }, [url, onError]);

  // Append canvas elements when renderedPages updates
  useEffect(() => {
    renderedPages.forEach((canvas, index) => {
      const container = pageRefs.current[index];
      if (container && !container.firstChild) {
        container.appendChild(canvas);
      }
    });
  }, [renderedPages]);

  return (
    <div 
      className="pdf-container w-full h-full overflow-auto" 
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {loading ? (
        <div className="flex flex-col gap-8 p-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex flex-col md:flex-row gap-8">
              <div className="w-full md:w-1/2 space-y-4">
                <Skeleton className="aspect-[3/4] rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </div>
              <div className="w-full md:w-1/2 space-y-4">
                <Skeleton className="aspect-[3/4] rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-8 p-4">
          {Array.from({ length: Math.ceil(renderedPages.length / 2) }).map((_, index) => (
            <div key={index} className="flex gap-4 justify-center">
              <div ref={el => { pageRefs.current[index * 2] = el; }} className="flex-1" />
              {index * 2 + 1 < renderedPages.length && (
                <div ref={el => { pageRefs.current[index * 2 + 1] = el; }} className="flex-1" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 