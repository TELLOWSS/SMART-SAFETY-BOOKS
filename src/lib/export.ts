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

function cleanOklchColors(html: string): string {
  return html.replace(/oklch\([^)]*\)/g, '#000000');
}

function prepareCloneForCapture(clone: HTMLElement): void {
  const allElements = [clone, ...Array.from(clone.querySelectorAll('*'))] as HTMLElement[];
  
  allElements.forEach(el => {
    const style = el.getAttribute('style') || '';
    if (style.includes('oklch')) {
      const cleanedStyle = cleanOklchColors(style);
      el.setAttribute('style', cleanedStyle);
    }
    
    try {
      const computed = window.getComputedStyle(el);
      const color = computed.color;
      const bg = computed.backgroundColor;
      
      if (color && color.toLowerCase() !== 'rgba(0, 0, 0, 0)') {
        el.style.color = color;
      }
      if (bg && bg.toLowerCase() !== 'rgba(0, 0, 0, 0)') {
        el.style.backgroundColor = bg;
      }
    } catch (e) {
      // Ignore errors from computed style
    }
  });
}

export async function captureElement(element: HTMLElement) {
  await waitForRenderAssets(element);
  
  const clone = element.cloneNode(true) as HTMLElement;
  prepareCloneForCapture(clone);
  
  document.body.appendChild(clone);
  clone.style.position = 'fixed';
  clone.style.left = '-9999px';
  clone.style.top = '-9999px';
  
  try {
    return await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowHeight: clone.scrollHeight,
      windowWidth: clone.scrollWidth
    });
  } catch (error) {
    console.error('html2canvas error:', error);
    throw new Error(`화면 캡처 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  } finally {
    document.body.removeChild(clone);
  }
}


export function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportElementsToPdf(elements: HTMLElement[], fileNamePrefix: string) {
  if (elements.length === 0) {
    throw new Error('No elements to export');
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let hasPage = false;

  for (let elemIndex = 0; elemIndex < elements.length; elemIndex += 1) {
    try {
      const element = elements[elemIndex];
      const canvas = await captureElement(element);
      const sliceCanvas = document.createElement('canvas');
      const sliceContext = sliceCanvas.getContext('2d');
      if (!sliceContext) {
        throw new Error('Canvas context를 생성할 수 없습니다');
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
    } catch (error) {
      console.error(`PDF export error for element ${elemIndex + 1}:`, error);
      throw new Error(`${elemIndex + 1}번 일지 PDF 캡처 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  const now = new Date().toISOString().slice(0, 10);
  pdf.save(`${fileNamePrefix}-${now}.pdf`);
}

export async function exportElementsToPng(elements: HTMLElement[], fileNamePrefix: string) {
  if (elements.length === 0) {
    throw new Error('No elements to export');
  }

  const now = new Date().toISOString().slice(0, 10);
  for (let index = 0; index < elements.length; index += 1) {
    try {
      const canvas = await captureElement(elements[index]);
      const fileName = `${fileNamePrefix}-${index + 1}-${now}.png`;
      downloadDataUrl(canvas.toDataURL('image/png'), fileName);
    } catch (error) {
      console.error(`PNG export error for element ${index + 1}:`, error);
      throw new Error(`${index + 1}번 일지 이미지 캡처 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }
}
