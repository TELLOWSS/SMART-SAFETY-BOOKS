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

export async function captureElement(element: HTMLElement) {
  await waitForRenderAssets(element);
  return html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff'
  });
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

  for (const element of elements) {
    const canvas = await captureElement(element);
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
  pdf.save(`${fileNamePrefix}-${now}.pdf`);
}

export async function exportElementsToPng(elements: HTMLElement[], fileNamePrefix: string) {
  if (elements.length === 0) {
    throw new Error('No elements to export');
  }

  const now = new Date().toISOString().slice(0, 10);
  for (let index = 0; index < elements.length; index += 1) {
    const canvas = await captureElement(elements[index]);
    const fileName = `${fileNamePrefix}-${index + 1}-${now}.png`;
    downloadDataUrl(canvas.toDataURL('image/png'), fileName);
  }
}
