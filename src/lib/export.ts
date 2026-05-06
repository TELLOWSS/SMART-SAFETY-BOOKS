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

function prepareCloneForCapture(clone: HTMLElement): void {
  const colorProperties = [
    'color',
    'backgroundColor',
    'borderColor',
    'borderTopColor',
    'borderRightColor',
    'borderBottomColor',
    'borderLeftColor',
    'outlineColor',
    'textDecorationColor',
    'caretColor'
  ];

  const allElements = [clone, ...Array.from(clone.querySelectorAll('*'))] as HTMLElement[];
  
  allElements.forEach(el => {
    try {
      const computed = window.getComputedStyle(el);
      const inlineStyle = el.getAttribute('style') || '';
      
      // 첫째: 인라인 스타일에서 oklch 제거
      let cleanedStyle = inlineStyle.replace(/oklch\([^)]*\)/g, '');
      
      // 둘째: computed style에서 색상 속성들을 명시적으로 설정
      colorProperties.forEach(prop => {
        try {
          const value = computed.getPropertyValue(prop);
          if (value && !value.includes('oklch')) {
            if (!cleanedStyle.includes(`${prop}:`)) {
              cleanedStyle += `; ${prop}: ${value}`;
            }
          }
        } catch (e) {
          // Ignore
        }
      });
      
      // 셋째: border 스타일도 명시적으로 설정
      const borderStyle = computed.borderStyle;
      const borderWidth = computed.borderWidth;
      if (borderStyle && borderWidth) {
        cleanedStyle += `; border-style: ${borderStyle}; border-width: ${borderWidth}`;
      }
      
      el.setAttribute('style', cleanedStyle);
      
      // 넷째: 스타일 태그에서도 oklch 제거
      if (el.tagName === 'STYLE' && el.textContent) {
        el.textContent = el.textContent.replace(/oklch\([^)]*\)/g, '#000000');
      }
    } catch (e) {
      console.warn('Style processing error for element:', e);
    }
  });
}

export async function captureElement(element: HTMLElement) {
  await waitForRenderAssets(element);
  
  const clone = element.cloneNode(true) as HTMLElement;
  
  document.body.appendChild(clone);
  clone.style.position = 'fixed';
  clone.style.left = '-9999px';
  clone.style.top = '-9999px';
  
  // 임시 스타일 시트 생성: oklch 색상에 fallback 제공
  const tempStyle = document.createElement('style');
  tempStyle.textContent = `
    * {
      color: inherits !important;
      background-color: inherit !important;
      border-color: #000 !important;
      box-shadow: none !important;
    }
  `;
  clone.appendChild(tempStyle);
  
  // 모든 style 태그에서 oklch 제거
  const styleElements = [
    ...document.querySelectorAll('style'),
    ...clone.querySelectorAll('style')
  ];
  
  const originalContents = new Map<HTMLStyleElement, string>();
  styleElements.forEach(el => {
    if (el.textContent) {
      originalContents.set(el, el.textContent);
      el.textContent = el.textContent.replace(/oklch\([^)]*\)/g, '#000000');
    }
  });
  
  prepareCloneForCapture(clone);
  
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
    // 원본 복구
    originalContents.forEach((content, el) => {
      el.textContent = content;
    });
    console.error('html2canvas error:', error);
    throw new Error(`화면 캡처 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  } finally {
    // 원본 복구
    originalContents.forEach((content, el) => {
      el.textContent = content;
    });
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
