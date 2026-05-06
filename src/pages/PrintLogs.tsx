import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import DailyLogForm from './DailyLogForm';
import { Printer, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrintLogs() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const idsParam = searchParams.get('ids');
  const ids = idsParam ? idsParam.split(',') : [];

  useEffect(() => {
    // Optionally auto-print when loaded, but let's give the user control
  }, []);

  return (
    <div className="bg-neutral-100 min-h-screen">
      <div className="max-w-5xl mx-auto p-4 print:hidden sticky top-0 z-50 bg-neutral-100 border-b border-neutral-200 mb-8 flex flex-col gap-3 shadow-sm">
        <div className="flex justify-between items-center">
          <button onClick={() => navigate(-1)} className="text-neutral-500 hover:text-neutral-900 flex items-center font-medium">
            <ArrowLeft className="w-5 h-5 mr-1" /> 돌아가기
          </button>
          <div className="flex items-center space-x-4">
            <span className="text-neutral-600 font-medium">{ids.length}개의 일지 렌더링됨</span>
            <button 
               onClick={() => window.print()}
               className="inline-flex items-center px-5 py-2 bg-neutral-900 text-white rounded-md font-medium hover:bg-black shadow"
            >
               <Printer className="w-4 h-4 mr-2" />
               PDF/이미지 저장
            </button>
          </div>
        </div>
        <div className="text-xs text-neutral-500 ml-auto">
          💡 <strong>품질 최적화:</strong> 버튼 클릭 후 "PDF로 저장" 또는 "인쇄 미리보기"에서 스크린샷 사용
        </div>
      </div>

      <div className="flex flex-col space-y-12 print:space-y-0 px-4 print:p-0">
        {ids.length > 0 ? (
          ids.map((id, index) => (
             <div key={id} className="bg-white print:bg-transparent p-8 print:p-0 shadow print:shadow-none mx-auto w-full max-w-5xl">
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
