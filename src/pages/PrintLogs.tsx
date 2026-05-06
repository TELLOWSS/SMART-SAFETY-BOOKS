import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DailyLogForm from './DailyLogForm';
import { Printer, ArrowLeft, FileDown, ImageDown, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

async function waitForRenderAssets(element: HTMLElement) {
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(
      image =>
        new Promise<void>(resolve => {
          if (image.complete) {
            resolve();
            return;
          }
          image.onload = () => resolve();
          image.onerror = () => resolve();
        })
    )
  );

  if ((document as any).fonts?.ready) {
    await (document as any).fonts.ready;
  }
}

async function captureElement(element: HTMLElement) {
  await waitForRenderAssets(element);
  return html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff'
  });
}

function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function PrintLogs() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const idsParam = searchParams.get('ids');
  const ids = idsParam ? idsParam.split(',') : [];
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);

  const getExportTargets = () => Array.from(document.querySelectorAll<HTMLElement>('[data-export-log="true"]'));

  const handleExportPdf = async () => {
    const targets = getExportTargets();
    if (targets.length === 0) {
      alert('저장할 일지가 없습니다.');
      return;
    }

    setIsExportingPdf(true);
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let hasPage = false;

      for (const target of targets) {
        const canvas = await captureElement(target);
        const sliceCanvas = document.createElement('canvas');
        const sliceContext = sliceCanvas.getContext('2d');
        if (!sliceContext) {
          continue;
        }

        const pagePixelHeight = Math.floor((canvas.width * pageHeight) / pageWidth);
        for (let y = 0; y < canvas.height; y += pagePixelHeight) {
          const sliceHeight = Math.min(pagePixelHeight, canvas.height - y);
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = sliceHeight;
          sliceContext.clearRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          sliceContext.drawImage(canvas, 0, y, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

          if (hasPage) {
            pdf.addPage();
          }

          const imageData = sliceCanvas.toDataURL('image/png');
          const renderedHeight = (sliceHeight * pageWidth) / canvas.width;
          pdf.addImage(imageData, 'PNG', 0, 0, pageWidth, renderedHeight, undefined, 'FAST');
          hasPage = true;
        }
      }

      const now = new Date().toISOString().slice(0, 10);
      pdf.save(`daily-logs-${now}.pdf`);
    } catch (error) {
      console.error(error);
      alert('PDF 저장 중 오류가 발생했습니다.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportImage = async () => {
    const targets = getExportTargets();
    if (targets.length === 0) {
      alert('저장할 일지가 없습니다.');
      return;
    }

    setIsExportingImage(true);
    try {
      const now = new Date().toISOString().slice(0, 10);
      for (let index = 0; index < targets.length; index += 1) {
        const canvas = await captureElement(targets[index]);
        const fileName = `daily-log-${index + 1}-${now}.png`;
        downloadDataUrl(canvas.toDataURL('image/png'), fileName);
      }
    } catch (error) {
      console.error(error);
      alert('이미지 저장 중 오류가 발생했습니다.');
    } finally {
      setIsExportingImage(false);
    }
  };

  useEffect(() => {
    // Optionally auto-print when loaded, but let's give the user control
  }, []);

  return (
    <div className="bg-neutral-100 min-h-screen">
      <div className="max-w-5xl mx-auto p-4 print:hidden sticky top-0 z-50 bg-neutral-100 border-b border-neutral-200 mb-8 flex justify-between items-center shadow-sm">
        <button onClick={() => navigate(-1)} className="text-neutral-500 hover:text-neutral-900 flex items-center font-medium">
          <ArrowLeft className="w-5 h-5 mr-1" /> 돌아가기
        </button>
        <div className="flex items-center space-x-4">
          <span className="text-neutral-600 font-medium">{ids.length}개의 일지 렌더링됨</span>
          <button
            onClick={handleExportImage}
            disabled={isExportingImage || isExportingPdf}
            className="inline-flex items-center px-4 py-2 bg-white border border-neutral-300 text-neutral-700 rounded-md font-medium hover:bg-neutral-50 disabled:opacity-50"
          >
            {isExportingImage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageDown className="w-4 h-4 mr-2" />}
            이미지 저장
          </button>
          <button
            onClick={handleExportPdf}
            disabled={isExportingPdf || isExportingImage}
            className="inline-flex items-center px-4 py-2 bg-neutral-700 text-white rounded-md font-medium hover:bg-neutral-800 disabled:opacity-50"
          >
            {isExportingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
            PDF 저장
          </button>
          <button 
             onClick={() => window.print()}
             className="inline-flex items-center px-5 py-2 bg-neutral-900 text-white rounded-md font-medium hover:bg-black shadow"
          >
             <Printer className="w-4 h-4 mr-2" />
             인쇄
          </button>
        </div>
      </div>

      <div className="flex flex-col space-y-12 print:space-y-0 px-4 print:p-0">
        {ids.length > 0 ? (
          ids.map((id, index) => (
             <div key={id} data-export-log="true" className="bg-white print:bg-transparent p-8 print:p-0 shadow print:shadow-none mx-auto w-full max-w-5xl">
                <div className="print:hidden text-center text-sm font-bold text-neutral-400 mb-4 tracking-widest">{index + 1}번째 일지</div>
                <DailyLogForm logIdProp={id} />
             </div>
          ))
        ) : (
          <div className="text-center p-12 text-neutral-500">인쇄할 일지가 선택되지 않았습니다.</div>
        )}
      </div>
    </div>
  );
}
