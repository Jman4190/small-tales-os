"use client";

import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocumentProxy, PDFPageProxy, OnProgressParameters } from "pdfjs-dist";

// Initialize PDF.js worker only once, outside the component
if (typeof window !== "undefined") {
  try {
    const workerSrc = `${window.location.origin}/pdf.worker.min.js`;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
    
    // Preload worker
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "script";
    link.href = workerSrc;
    document.head.appendChild(link);
  } catch (error) {
    console.error("[PDF] Worker initialization error:", error);
  }
}

interface PDFViewerProps {
  url: string;
  onError?: (error: Error) => void;
}

export function PDFViewer({ url, onError }: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const currentScale = 1.2;
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const renderedPages = useRef(new Set<number>());
  const mountedRef = useRef(true);
  // Track the current URL to prevent unnecessary reloads
  const lastUrlRef = useRef<string>("");

  // Add ref to track canvas elements
  const canvasElements = useRef<HTMLCanvasElement[]>([]);

  const renderPage = async (page: PDFPageProxy, container: HTMLDivElement) => {
    const pageNum = page._pageIndex + 1;
    
    if (renderedPages.current.has(pageNum)) {
      console.log(`[PDF] Skipping already rendered page ${pageNum}`);
      return;
    }
    
    console.log(`[PDF] Starting to render page ${pageNum}`);
    renderedPages.current.add(pageNum);

    const canvas = document.createElement('canvas');
    canvasElements.current.push(canvas); // Track canvas element
    const context = canvas.getContext('2d');
    if (!context) {
      console.error('[PDF] Failed to get canvas context');
      return;
    }

    const viewport = page.getViewport({ scale: currentScale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    console.log(`[PDF] Page ${pageNum} viewport:`, {
      width: viewport.width,
      height: viewport.height,
      scale: currentScale
    });

    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.style.marginBottom = '20px';

    try {
      if (mountedRef.current && container.isConnected) { // Check if container is still in DOM
        container.appendChild(canvas);
      }
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
      console.log(`[PDF] Successfully rendered page ${pageNum}`);
    } catch (error) {
      console.error(`[PDF] Error rendering page ${pageNum}:`, error);
      setLoadingError(`Failed to render page ${pageNum}`);
      onError?.(error as Error);
    }
  };

  const loadPDF = async (container: HTMLDivElement) => {
    try {
      console.log('[PDF] Starting PDF load process');
      setLoading(true);
      setProgress(0);
      setLoadingError(null);
      renderedPages.current.clear();

      // Clean up previous canvases
      canvasElements.current.forEach(canvas => {
        if (canvas && canvas.parentNode === container) {
          container.removeChild(canvas);
        }
      });
      canvasElements.current = [];

      console.log('[PDF] Loading PDF from URL:', url);
      const loadingTask = pdfjsLib.getDocument({
        url,
        disableFontFace: false,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
        enableXfa: true, // Add support for XFA forms
        isEvalSupported: false, // Disable eval for security
        useSystemFonts: true, // Use system fonts when possible
      });

      loadingTask.onProgress = (progressData: OnProgressParameters) => {
        if (!mountedRef.current) return;
        const percentage = Math.round((progressData.loaded / progressData.total) * 100);
        console.log(`[PDF] Loading progress: ${percentage}%`);
        setProgress(percentage);
      };

      const pdf = await loadingTask.promise;
      if (!mountedRef.current) return;

      console.log(`[PDF] Successfully loaded PDF with ${pdf.numPages} pages`);
      setPdfDoc(pdf);

      // Render pages sequentially
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (!mountedRef.current) break;
        
        // Skip pages 2 and 6
        if (pageNum === 2 || pageNum === 6) {
          console.log(`[PDF] Skipping blank page ${pageNum}`);
          continue;
        }
        
        try {
          console.log(`[PDF] Getting page ${pageNum}`);
          const page = await pdf.getPage(pageNum);
          if (container.isConnected) {
            await renderPage(page, container);
            // Wait for each page to complete before moving to next
            await new Promise(resolve => setTimeout(resolve, 0));
          } else {
            console.log('[PDF] Container no longer connected, stopping render');
            break;
          }
        } catch (error) {
          console.error(`[PDF] Error rendering page ${pageNum}:`, error);
          // Continue with next page instead of breaking completely
          continue;
        }
      }

    } catch (error) {
      console.error('[PDF] Critical error:', error);
      if (mountedRef.current) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error loading PDF';
        setLoadingError(errorMessage);
        onError?.(error as Error);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    async function initPDF() {
      try {
        // Skip loading if URL hasn't changed and PDF is already loaded
        if (url === lastUrlRef.current && pdfDoc !== null) {
          console.log('[PDF] Skipping reload - same URL and PDF already loaded');
          return;
        }
        
        // Update the last URL ref
        lastUrlRef.current = url;
        
        if (!containerRef.current) {
          console.log('[PDF] Waiting for container ref...');
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!containerRef.current || !mountedRef.current) {
          throw new Error('Container initialization failed or component unmounted');
        }

        await loadPDF(containerRef.current);
      } catch (error) {
        console.error('[PDF] Initialization error:', error);
        if (mountedRef.current) {
          setLoadingError(error instanceof Error ? error.message : 'PDF initialization failed');
          onError?.(error as Error);
        }
      }
    }

    if (url) {
      initPDF();
    }

    return () => {
      mountedRef.current = false;
      // Cleanup code...
    };
  }, [url, onError]);

  if (!url) {
    return null;
  }

  if (loadingError) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-red-500">
          <h3 className="font-bold">Error loading PDF</h3>
          <p>{loadingError}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div 
        ref={containerRef} 
        className="pdf-container w-full h-full overflow-auto"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          minHeight: '300px',
          background: '#f5f5f5',
          position: 'relative'
        }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <div>Loading PDF ({progress}%)</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!pdfDoc) {
    return null;
  }

  return (
    <div 
      ref={containerRef} 
      className="pdf-container w-full h-full overflow-auto"
      style={{ 
        WebkitOverflowScrolling: 'touch',
        minHeight: '300px',
        background: '#f5f5f5',
        position: 'relative'
      }}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <div>Loading PDF ({progress}%)</div>
          </div>
        </div>
      )}
    </div>
  );
} 