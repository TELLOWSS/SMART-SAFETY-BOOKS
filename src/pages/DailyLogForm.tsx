import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection } from 'firebase/firestore';
import { db, auth, handleFirestoreError } from '../lib/auth';
import { DailyLog, ChecklistData, RelatedPhoto } from '../lib/types';
import { MUST_DO_GUIDELINES, FIVE_PROHIBITIONS, HIGH_RISK_ASSESSMENTS, PTW_INSPECTION } from '../lib/checklistTypes';
import { ArrowLeft, Save, Sparkles, Loader2, Camera, Plus, Trash2, Printer } from 'lucide-react';
import { format } from 'date-fns';

import { triggerHaptic } from '../lib/haptic';

function captureAndCompressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Fill with white background to prevent transparent areas from turning black in JPEG
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }
        triggerHaptic('success');
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DailyLogForm({ logIdProp }: { logIdProp?: string }) {
  const { id: routeId } = useParams();
  const id = logIdProp || routeId;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  const [highRiskItems, setHighRiskItems] = useState(HIGH_RISK_ASSESSMENTS);

  // Form State
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [workerStaff, setWorkerStaff] = useState(0);
  const [workerLaborer, setWorkerLaborer] = useState(0);
  const [tasks, setTasks] = useState('');
  const [education, setEducation] = useState('특이사항 없음');
  const [others, setOthers] = useState('특이사항 없음');
  
  // Hazards state
  const [hazardsText, setHazardsText] = useState('');
  const [actionsText, setActionsText] = useState('');
  
  const [checklist, setChecklist] = useState<ChecklistData>({});
  const [relatedPhotos, setRelatedPhotos] = useState<RelatedPhoto[]>([]);
  const [aiSummary, setAiSummary] = useState('');
  const [managerSignature, setManagerSignature] = useState('');
  const [directorSignature, setDirectorSignature] = useState('');
  const [hiddenSections, setHiddenSections] = useState<Record<string, boolean>>({});

  const generateSummary = async () => {
    if (!hazardsText && !actionsText) {
      alert("위험 요소와 시정 조치를 먼저 입력해주세요.");
      return;
    }
    setSummarizing(true);
    try {
      const res = await fetch('/api/summarize-hazards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hazards: hazardsText, actions: actionsText })
      });
      const data = await res.json();
      if (data.summary) {
        setAiSummary(data.summary);
      } else {
        alert("요약을 생성하는데 실패했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("서버 오류가 발생했습니다.");
    } finally {
      setSummarizing(false);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
       if (user) {
         if (id) loadLog();
         else loadDefaults();
       }
    });
    return () => unsubscribe();
  }, [id]);

  const loadDefaults = async () => {
    try {
      const reqId = auth.currentUser?.uid;
      if (reqId) {
         const snap = await getDoc(doc(db, 'settings', `risk_assessment_${reqId}`));
         if (snap.exists() && snap.data()?.items) {
             setHighRiskItems(snap.data()?.items);
         }
      }
    } catch(e) {}
  };

  const loadLog = async () => {
    if (!id || !auth.currentUser) return;
    setLoading(true);
    try {
      const docRef = doc(db, 'logs', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDate(data.date);
        setWorkerStaff(data.workerStaff);
        setWorkerLaborer(data.workerLaborer);
        setTasks(data.tasks);
        setEducation(data.education || '');
        setOthers(data.others || '');
        setHazardsText(data.hazardsText || '');
        setActionsText(data.actionsText || '');
        setAiSummary(data.aiSummary || '');
        if (data.checklistData) {
          setChecklist(JSON.parse(data.checklistData));
        }
        if (data.relatedPhotosData) {
          setRelatedPhotos(JSON.parse(data.relatedPhotosData));
        }
        setManagerSignature(data.managerSignature || '');
        setDirectorSignature(data.directorSignature || '');
        setHiddenSections(data.hiddenSections || {});
        
        try {
           const reqId = auth.currentUser?.uid;
           if (reqId) {
             const snap = await getDoc(doc(db, 'settings', `risk_assessment_${reqId}`));
             if (snap.exists() && snap.data()?.items) {
                 setHighRiskItems(snap.data()?.items);
             }
           }
        } catch(e) {}
        
      }
    } catch (error) {
      handleFirestoreError(error, 'get', 'logs');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    
    try {
      const logId = id || doc(collection(db, 'logs')).id;
      const logRef = doc(db, 'logs', logId);
      
      const logData = {
        ownerId: auth.currentUser.uid,
        date,
        workerStaff: Number(workerStaff),
        workerLaborer: Number(workerLaborer),
        tasks,
        education,
        others,
        hazardsText,
        actionsText,
        checklistData: JSON.stringify(checklist),
        relatedPhotosData: JSON.stringify(relatedPhotos),
        aiSummary,
        managerSignature,
        directorSignature,
      };

      if (id) {
        await updateDoc(logRef, { ...logData, updatedAt: serverTimestamp() });
      } else {
        await setDoc(logRef, { 
          ...logData, 
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp() 
        });
      }

      if (!id) {
        navigate(`/logs/${logId}`);
      } else {
        alert('저장되었습니다.');
      }
    } catch (error) {
      console.error(error);
      handleFirestoreError(error, 'write', 'logs');
    } finally {
      setLoading(false);
    }
  };

  const handleChecklistChange = (id: string, field: 'status' | 'action' | 'photoUrl' | 'category' | 'hazard' | 'hazardTop' | 'hazardBottom', value: any) => {
    if (field === 'status' && value === '양호') {
      triggerHaptic('success');
    } else if (field === 'status' && value === '불량') {
      triggerHaptic('warn');
    } else {
      triggerHaptic('light');
    }

    setChecklist(prev => {
      const curr = prev[id] || { status: 'N/A', action: '작업없음', photoUrl: '' };
      return {
        ...prev,
        [id]: { ...curr, [field]: value }
      };
    });
  };

  const handleChecklistPhotoUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const compressedBase64 = await captureAndCompressImage(e.target.files[0]);
        handleChecklistChange(id, 'photoUrl', compressedBase64);
      } catch (err) {
        console.error("Image compression failed", err);
      }
    }
  };

  const addRelatedPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const compressedBase64 = await captureAndCompressImage(e.target.files[0]);
        setRelatedPhotos(prev => [...prev, {
          id: Date.now().toString(),
          date: format(new Date(), 'MM/dd'),
          location: '',
          issue: '',
          imageUrl: compressedBase64
        }]);
      } catch (err) {
        console.error("Image compression failed", err);
      }
    }
  };

  const updateRelatedPhoto = (id: string, field: 'location' | 'issue', value: string) => {
    setRelatedPhotos(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removeRelatedPhoto = (id: string) => {
    setRelatedPhotos(prev => prev.filter(p => p.id !== id));
  };

  const renderChecklistGroup = (title: string, items: any[], firstColTitle: string, secondColTitle: string) => {
    const isHidden = hiddenSections[title];
    return (
    <div className={`flex flex-col border-black break-inside-avoid shadow-sm print:shadow-none mb-0 print:mb-4 ${isHidden ? 'print:hidden' : ''}`}>
      <div className="flex border-b-2 border-black bg-white group/title relative">
        <div className="flex-1 font-bold text-lg p-2 text-center">{title} {isHidden && <span className="text-sm font-normal text-red-500">(숨김 상태 - 인쇄 안됨)</span>}</div>
        <button 
          onClick={() => setHiddenSections(p => ({ ...p, [title]: !p[title] }))}
          className="absolute right-2 top-2 px-2 py-1 bg-neutral-200 hover:bg-neutral-300 rounded text-xs print:hidden opacity-0 group-hover/title:opacity-100 transition-opacity z-10"
        >
          {isHidden ? '숨김 해제' : '인쇄 시 숨기기'}
        </button>
      </div>

      {!isHidden && (
      <>
      {/* Header Row */}
      <div className="grid grid-cols-[100px_1fr_160px_1.2fr] border-b-2 border-black text-center font-bold bg-neutral-50 print:bg-white text-sm">
        <div className="border-r-2 border-black flex items-center justify-center p-2">{firstColTitle}</div>
        <div className="border-r-2 border-black flex flex-col justify-center p-0">
          {secondColTitle === '유해위험요인/감소대책' ? (
            <>
               <div className="flex-1 flex items-center justify-center border-b border-black p-2">유해위험요인</div>
               <div className="flex-1 flex items-center justify-center p-2">감소대책</div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-2">{secondColTitle}</div>
          )}
        </div>
        <div className="border-r-2 border-black flex items-center justify-center p-2">점검사진</div>
        <div className="flex items-center justify-center p-2">점검내용</div>
      </div>
      
      {/* Content Rows */}
      <div className="flex flex-col bg-white border-b-2 border-black">
        {items.map((item, index) => {
          const val = checklist[item.id] || { status: 'N/A', action: '작업없음', photoUrl: '' };
          const rowHiddenId = `${title}_${item.id}`;
          const isRowHidden = hiddenSections[rowHiddenId];
          const isLast = index === items.length - 1;

          if (isRowHidden) {
            return (
              <div key={item.id} className={`flex border-black p-2 items-center justify-between text-sm bg-neutral-100 opacity-60 print:hidden ${isLast ? '' : 'border-b'}`}>
                <span>{item.category} (숨김)</span>
                <button onClick={() => setHiddenSections(p => ({ ...p, [rowHiddenId]: false }))} className="px-2 py-1 bg-neutral-200 hover:bg-neutral-300 rounded text-xs">숨김 해제</button>
              </div>
            );
          }

          return (
            <div key={item.id} className={`grid grid-cols-[100px_1fr_160px_1.2fr] min-h-[100px] break-inside-avoid text-sm group/row relative ${isLast ? '' : 'border-b border-black'}`}>
              <button 
                onClick={() => setHiddenSections(p => ({ ...p, [rowHiddenId]: true }))}
                className="absolute top-1 left-1 px-1.5 py-0.5 bg-neutral-200 hover:bg-neutral-300 rounded text-[10px] print:hidden opacity-0 group-hover/row:opacity-100 transition-opacity z-10"
              >
                숨기기
              </button>
              <div className="p-2 border-r-2 border-black flex items-center justify-center text-center break-words font-medium">
                <div 
                  contentEditable 
                  suppressContentEditableWarning 
                  onBlur={(e) => handleChecklistChange(item.id, 'category', e.currentTarget.innerText)}
                  className="outline-none focus:bg-yellow-50 focus:ring-2 focus:ring-blue-400 p-1 rounded min-w-[50px]"
                >
                  {val.category !== undefined ? val.category : item.category}
                </div>
              </div>
              
              <div className="border-r-2 border-black flex flex-col justify-center text-center">
                {item.hazardTop ? (
                  <>
                     <div className="flex-1 p-2 border-b border-black flex items-center justify-center whitespace-pre-wrap break-words">
                       <div 
                          contentEditable 
                          suppressContentEditableWarning
                          onBlur={(e) => handleChecklistChange(item.id, 'hazardTop', e.currentTarget.innerText)}
                          className="outline-none focus:bg-yellow-50 focus:ring-2 focus:ring-blue-400 p-1 w-full rounded"
                       >
                         {val.hazardTop !== undefined ? val.hazardTop : item.hazardTop}
                       </div>
                     </div>
                     <div className="flex-1 p-2 flex items-center justify-center whitespace-pre-wrap break-words">
                       <div 
                          contentEditable 
                          suppressContentEditableWarning
                          onBlur={(e) => handleChecklistChange(item.id, 'hazardBottom', e.currentTarget.innerText)}
                          className="outline-none focus:bg-yellow-50 focus:ring-2 focus:ring-blue-400 p-1 w-full rounded"
                       >
                         {val.hazardBottom !== undefined ? val.hazardBottom : item.hazardBottom}
                       </div>
                     </div>
                  </>
                ) : (
                  <div className="p-2 flex-1 flex items-center justify-center whitespace-pre-wrap break-words">
                    <div 
                        contentEditable 
                        suppressContentEditableWarning
                        onBlur={(e) => handleChecklistChange(item.id, 'hazard', e.currentTarget.innerText)}
                        className="outline-none focus:bg-yellow-50 focus:ring-2 focus:ring-blue-400 p-1 w-full rounded"
                    >
                      {val.hazard !== undefined ? val.hazard : item.hazard}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="border-r-2 border-black flex flex-col items-center justify-center relative bg-white p-1">
                {val.photoUrl ? (
                  <div className="relative group w-full h-full min-h-[100px] flex items-center justify-center overflow-hidden">
                    <img src={val.photoUrl} alt="Inspection" className="max-w-full max-h-full object-contain" />
                    <button 
                      onClick={() => handleChecklistChange(item.id, 'photoUrl', '')}
                      className="absolute top-1 right-1 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity print:hidden shadow"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer text-blue-500 hover:text-blue-700 flex flex-col items-center justify-center w-full h-full min-h-[100px] print:hidden bg-neutral-50 hover:bg-neutral-100 transition-colors border border-dashed border-neutral-300 m-1 rounded">
                    <Camera className="w-5 h-5 mb-1" />
                    <span className="text-xs font-semibold">사진 추가</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleChecklistPhotoUpload(item.id, e)} />
                  </label>
                )}
                {!val.photoUrl && <span className="hidden print:flex items-center justify-center w-full h-full text-neutral-400 font-semibold">N/A</span>}
              </div>
              
              <div className="p-3 flex flex-col gap-2 relative">
                 <div className="flex items-center space-x-2">
                   <select 
                     value={val.status} 
                     onChange={(e) => handleChecklistChange(item.id, 'status', e.target.value)}
                     className={`block border text-sm print:hidden rounded p-1.5 focus:border-blue-500 focus:ring-blue-500 font-semibold transition-all duration-300 outline-none
                       ${val.status === '양호' ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm shadow-emerald-200/50' : ''}
                       ${val.status === '불량' ? 'bg-rose-50 text-rose-700 border-rose-300 shadow-sm shadow-rose-200/50' : ''}
                       ${val.status === 'N/A' || val.status === '미해당' ? 'border-neutral-300 text-neutral-600 bg-neutral-50' : ''}
                     `}
                   >
                     <option value="N/A">N/A</option>
                     <option value="양호">양호</option>
                     <option value="불량">불량</option>
                     <option value="미해당">미해당</option>
                   </select>
                   <span className="hidden print:inline-block font-bold">{val.status !== 'N/A' && val.status !== '미해당' ? val.status : ''}</span>
                 </div>
                 
                 <textarea 
                   value={val.action} 
                   onChange={(e) => handleChecklistChange(item.id, 'action', e.target.value)}
                   className="block w-full h-full border-neutral-200 shadow-sm text-sm print:hidden rounded resize-none focus:border-blue-500 focus:ring-blue-500 min-h-[60px]"
                   placeholder="점검내용 입력..."
                 />
                 <div className="hidden print:block whitespace-pre-wrap flex-1 mt-1 leading-relaxed">
                    {val.action !== '작업없음' && val.action !== '' ? val.action : (val.status === 'N/A' || val.status === '미해당' ? '' : '')}
                 </div>
              </div>
            </div>
          );
        })}
      </div>
      </>
      )}
    </div>
  );
  };

  return (
    <div className={`max-w-5xl mx-auto pb-12 w-full print:p-0 print:m-0 ${logIdProp ? 'print:break-after-page page-break-after-always pb-0' : ''}`}>
      {!logIdProp && (
        <div className="flex items-center justify-between mb-6 print:hidden">
          <button onClick={() => navigate('/logs')} className="text-neutral-500 hover:text-neutral-900 flex items-center text-sm font-medium">
            <ArrowLeft className="w-4 h-4 mr-1" /> 목록으로
          </button>
          <div className="flex flex-col items-end gap-3">
            <div className="text-xs text-neutral-500 text-right">
              💡 <strong>PDF/이미지 저장:</strong> "PDF 저장하기" 버튼 → 브라우저 인쇄 → "PDF로 저장" 또는 스크린샷 사용
            </div>
            <div className="space-x-2">
              <button 
                onClick={() => window.print()}
                className="inline-flex items-center px-4 py-2 bg-white border border-neutral-300 text-neutral-700 rounded-md font-medium text-sm hover:bg-neutral-50"
              >
                <Printer className="w-4 h-4 mr-1.5" />
                PDF 저장하기
              </button>
              <button 
                onClick={handleSave} 
                disabled={loading}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Configuration Panel */}
      <div className="bg-white p-4 border border-neutral-200 shadow-sm rounded-lg mb-6 print:hidden">
        <h3 className="text-sm font-bold text-neutral-800 mb-3 flex items-center">
          <Printer className="w-4 h-4 mr-1.5 text-blue-600" /> 인쇄 및 PDF 출력 항목 설정 (접기/펴기)
        </h3>
        <p className="text-xs text-neutral-500 mb-4">체크를 해제하면 인쇄 및 PDF 저장 시 해당 항목이 제외됩니다. (종이 절약 및 선택적 보고용)</p>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'top', label: '상단 (출역/작업/위험요소/교육 등)' },
            { id: '관련사진', label: '관련사진' },
            { id: '필수이행지침', label: '필수이행지침' },
            { id: '5대금지규정', label: '5대금지규정' },
            { id: '위험성평가 상등급 감소대책 이행여부', label: '위험성평가 이행여부' },
            { id: '중점위험작업(PTW) 점검', label: '중점위험작업(PTW)' }
          ].map(sec => (
            <label key={sec.id} className={`flex items-center space-x-2 px-3 py-1.5 rounded border border-neutral-200 cursor-pointer transition-colors ${!hiddenSections[sec.id] ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-white hover:bg-neutral-50 text-neutral-600'}`}>
              <input 
                type="checkbox" 
                checked={!hiddenSections[sec.id]} 
                onChange={() => setHiddenSections(p => ({ ...p, [sec.id]: !p[sec.id] }))} 
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium">{sec.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto print:overflow-visible pb-6 -mx-4 sm:mx-0 px-4 sm:px-0 scrollbar-hide styled-scrollbar">
        <div className="sm:hidden mb-2 flex items-center justify-center text-xs text-blue-600 bg-blue-50 py-1.5 rounded-md font-medium">
          <ArrowLeft className="w-3 h-3 mr-1 inline-block" /> 좌우로 스와이프하여 양식 작성 <ArrowLeft className="w-3 h-3 ml-1 inline-block rotate-180" />
        </div>
        <div className="print-form-root bg-white mx-auto print:shadow-none rounded-none sm:rounded-lg overflow-hidden print:overflow-visible text-neutral-900 border-2 border-black min-w-[800px] w-full break-keep shadow-sm relative group" style={{ fontFamily: 'serif', wordBreak: 'keep-all' }}>
        
        {/* Title & Signatures block */}
        <div className="flex justify-between items-stretch border-b-2 border-black">
          <div className="flex-1 flex items-center justify-center p-4">
            <h1 className="text-3xl font-bold tracking-[0.2em] whitespace-nowrap">안전전담자(관리자) 운영일지</h1>
          </div>
          <div className="w-56 border-l-2 border-black flex hidden print:flex sm:flex">
            <div className="w-8 flex flex-col items-center justify-center border-r border-black font-bold text-sm bg-neutral-50 print:bg-white gap-2 py-2">
              <span>결</span>
              <span>재</span>
            </div>
            <div className="flex-1 flex flex-col">
              <div className="flex bg-neutral-50 print:bg-white border-b border-black font-bold text-sm">
                <div className="flex-1 py-1 flex items-center justify-center border-r border-black">담당</div>
                <div className="flex-1 py-1 flex items-center justify-center">소장</div>
              </div>
              <div className="flex flex-1 min-h-[60px]">
                <div 
                  className="flex-1 border-r border-black relative group cursor-pointer justify-center items-center flex" 
                  onClick={() => document.getElementById('manager-sig')?.click()}
                >
                 {managerSignature ? (
                   <img src={managerSignature} alt="담당 서명" className="max-w-full max-h-full p-1 object-contain mix-blend-multiply" />
                 ) : (
                   <span className="text-xs text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">서명 추가</span>
                 )}
                 <input type="file" id="manager-sig" accept="image/*" className="hidden" onChange={async (e) => {
                   if (e.target.files && e.target.files[0]) {
                     try {
                       const base64 = await captureAndCompressImage(e.target.files[0]);
                       setManagerSignature(base64);
                     } catch(err) { console.error(err); }
                   }
                 }} />
                 {managerSignature && (
                   <button 
                     onClick={(e) => { e.stopPropagation(); setManagerSignature(''); }}
                     className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity print:hidden shadow"
                   >
                     <Trash2 className="w-3 h-3" />
                   </button>
                 )}
               </div>
               <div 
                 className="flex-1 relative group cursor-pointer justify-center items-center flex" 
                 onClick={() => document.getElementById('director-sig')?.click()}
               >
                 {directorSignature ? (
                   <img src={directorSignature} alt="소장 서명" className="max-w-full max-h-full p-1 object-contain mix-blend-multiply" />
                 ) : (
                   <span className="text-xs text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">서명 추가</span>
                 )}
                 <input type="file" id="director-sig" accept="image/*" className="hidden" onChange={async (e) => {
                   if (e.target.files && e.target.files[0]) {
                     try {
                       const base64 = await captureAndCompressImage(e.target.files[0]);
                       setDirectorSignature(base64);
                     } catch(err) { console.error(err); }
                   }
                 }} />
                 {directorSignature && (
                   <button 
                     onClick={(e) => { e.stopPropagation(); setDirectorSignature(''); }}
                     className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity print:hidden shadow"
                   >
                     <Trash2 className="w-3 h-3" />
                   </button>
                 )}
               </div>
              </div>
            </div>
          </div>
        </div>

        {/* Date Row through Education Section */}
        {hiddenSections['top'] ? (
           <div className="flex border-b-2 border-black bg-neutral-100 group/title relative print:hidden">
              <div className="flex-1 font-bold text-base p-2 text-center text-neutral-500">상단 기본 입력란 (숨김 상태 - 인쇄 안됨)</div>
           </div>
        ) : (
          <div className="flex flex-col">
            {/* Date Row */}
            <div className="flex border-b-2 border-black">
              <div className="w-24 flex items-center justify-center border-r-2 border-black font-semibold shrink-0">일 자</div>
              <div className="flex-1 p-2">
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full sm:w-auto p-1 border border-neutral-300 rounded print:border-0 text-lg outline-none" />
              </div>
            </div>

            {/* Worker Table */}
            <div className="flex border-b-2 border-black">
              <div className="w-24 flex items-center justify-center border-r-2 border-black font-semibold shrink-0">출역인원</div>
              <div className="flex-1 flex flex-col">
                <div className="flex border-b border-black font-semibold">
                  <div className="flex-1 p-2 text-center border-r border-black">구 분</div>
                  <div className="flex-1 p-2 text-center border-r border-black">직원</div>
                  <div className="flex-1 p-2 text-center border-r border-black">근로자</div>
                  <div className="flex-1 p-2 text-center">계</div>
                </div>
                <div className="flex font-semibold">
                  <div className="flex-1 p-2 text-center border-r border-black">일 계</div>
                  <div className="flex-1 p-2 text-center border-r border-black">
                     <input type="number" value={workerStaff} onChange={e => setWorkerStaff(Number(e.target.value))} className="w-full text-center print:border-0 border-b border-neutral-300 outline-none hover:bg-neutral-50 focus:bg-white" />
                  </div>
                  <div className="flex-1 p-2 text-center border-r border-black">
                     <input type="number" value={workerLaborer} onChange={e => setWorkerLaborer(Number(e.target.value))} className="w-full text-center print:border-0 border-b border-neutral-300 outline-none hover:bg-neutral-50 focus:bg-white" />
                  </div>
                  <div className="flex-1 p-2 text-center bg-neutral-50 print:bg-white">{workerStaff + workerLaborer}</div>
                </div>
              </div>
            </div>

            {/* Tasks */}
            <div className="flex border-b-2 border-black min-h-[250px]">
              <div className="w-24 flex items-center justify-center border-r-2 border-black font-semibold shrink-0">
                <div className="text-center w-8">주요<br/>작업<br/>내용</div>
              </div>
              <div className="flex-1 h-full">
                <textarea value={tasks} onChange={e => setTasks(e.target.value)} className="w-full h-full p-4 print:border-0 print:resize-none resize-y outline-none min-h-[250px] leading-relaxed" placeholder="주요 작업내용을 입력하세요..." />
              </div>
            </div>

            {/* Hazards and Actions */}
            <div className="flex flex-col sm:flex-row border-b-2 border-black min-h-[300px] break-inside-avoid">
              <div className="flex-1 flex flex-col sm:w-1/2 border-b sm:border-b-0 sm:border-r border-black">
                <div className="font-semibold text-center p-2 border-b border-black">위 험 요 소 (지 적 사 항)</div>
                <textarea value={hazardsText} onChange={e => setHazardsText(e.target.value)} className="flex-1 p-4 print:border-0 print:resize-none resize-y outline-none min-h-[200px]" placeholder="위험 요소 입력..." />
              </div>
              <div className="flex-1 flex flex-col sm:w-1/2">
                <div className="font-semibold text-center p-2 border-b border-black">시 정 조 치 (건 의 사 항)</div>
                <textarea value={actionsText} onChange={e => setActionsText(e.target.value)} className="flex-1 p-4 print:border-0 print:resize-none resize-y outline-none min-h-[200px]" placeholder="시정 조치 입력..." />
              </div>
            </div>

            {/* Education & Other */}
            <div className="flex flex-col border-b-2 border-black break-inside-avoid">
              <div className="flex border-b border-black">
                 <div className="w-32 sm:w-48 p-2 border-r border-black text-center font-semibold">교육행사</div>
                 <div className="flex-1 p-2">
                   <input type="text" value={education} onChange={e => setEducation(e.target.value)} className="w-full outline-none" />
                 </div>
              </div>
              <div className="flex">
                 <div className="w-32 sm:w-48 p-2 border-r border-black text-center font-semibold">기타사항</div>
                 <div className="flex-1 p-2">
                   <input type="text" value={others} onChange={e => setOthers(e.target.value)} className="w-full outline-none" />
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Summary Widget (Hide on Print) */}
        <div className="bg-blue-50 border-b border-blue-200 p-5 print:hidden">
           <div className="flex items-center justify-between mb-3">
              <div className="flex items-center text-blue-800 font-medium">
                <Sparkles className="w-5 h-5 mr-2" />
                AI 위험요소 자동 요약
              </div>
              <button 
                type="button"
                onClick={generateSummary}
                className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                disabled={summarizing}
              >
                {summarizing ? <Loader2 className="w-3 h-3 mr-1 animate-spin inline" /> : null}
                {summarizing ? '요약 중...' : '요약 생성하기'}
              </button>
           </div>
           <textarea 
             value={aiSummary} 
             onChange={e => setAiSummary(e.target.value)}
             className="w-full bg-white border border-blue-200 rounded p-3 text-sm min-h-[80px]" 
             placeholder="위험요소를 입력하고 요약 생성하기 버튼을 누르면 AI가 주요 위험 핵심을 요약합니다."
           />
        </div>

        {/* Related Photos Section */}
        {hiddenSections['관련사진'] ? (
           <div className="flex border-b-2 border-black bg-neutral-100 group/title relative print:hidden">
              <div className="flex-1 font-bold text-base p-2 text-center text-neutral-500">관련사진 (숨김 상태 - 인쇄 안됨)</div>
           </div>
        ) : (
        <div className="break-before-page pt-4 print:pt-12">
           <div className="border-t-[3px] border-b-[3px] border-double border-black p-2 flex items-center justify-center">
             <h2 className="text-2xl font-bold text-center tracking-[1em]">관 련 사 진</h2>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-0 border-b border-black">
             {relatedPhotos.map((photo, index) => {
                const isEven = index % 2 === 0;
                return (
                <div key={photo.id} className={`flex flex-col border-black bg-white break-inside-avoid border-b ${isEven ? 'md:border-r print:border-r' : ''}`}>
                  {/* Photo area */}
                  <div className="aspect-[4/3] w-full relative group bg-neutral-100 flex-shrink-0 border-b border-black">
                    {photo.imageUrl ? (
                      <img src={photo.imageUrl} alt="현장사진" className="absolute inset-0 w-full h-full object-contain" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-neutral-400">사진 없음</div>
                    )}
                    <button 
                      onClick={() => removeRelatedPhoto(photo.id)}
                      className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity print:hidden shadow"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Metadata fields */}
                  <div className="flex border-b border-black text-sm">
                    <div className="w-16 p-1.5 flex items-center justify-center border-r border-black bg-neutral-50 print:bg-white font-semibold">날짜</div>
                    <div className="w-24 p-1.5 flex items-center justify-center border-r border-black"><input value={photo.date} onChange={e => {
                        setRelatedPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, date: e.target.value } : p));
                    }} className="w-full text-center outline-none bg-transparent" /></div>
                    
                    <div className="w-16 p-1.5 flex items-center justify-center border-r border-black bg-neutral-50 print:bg-white font-semibold">위치</div>
                    <div className="flex-1 p-1.5 flex items-center"><input value={photo.location} onChange={e => updateRelatedPhoto(photo.id, 'location', e.target.value)} placeholder="위치 입력..." className="w-full outline-none bg-transparent" /></div>
                  </div>

                  <div className="flex text-sm min-h-[60px]">
                    <div className="w-16 p-2 flex items-center justify-center border-r border-black bg-neutral-50 print:bg-white font-semibold shrink-0">지적사항</div>
                    <div className="flex-1 p-2">
                       <textarea value={photo.issue} onChange={e => updateRelatedPhoto(photo.id, 'issue', e.target.value)} placeholder="지적사항 입력..." className="w-full h-full resize-none outline-none bg-transparent" />
                    </div>
                  </div>
                </div>
                );
             })}

             {/* Add button placeholder */}
             <div className={`flex flex-col items-center justify-center aspect-[4/3] hover:bg-neutral-200 transition bg-neutral-50 cursor-pointer print:hidden p-4 border-b border-black ${relatedPhotos.length % 2 === 0 ? 'md:border-r print:border-r' : ''}`}>
                <label className="flex flex-col items-center cursor-pointer text-blue-600 w-full h-full justify-center">
                   <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                     <Plus className="w-8 h-8" />
                   </div>
                   <span className="font-semibold">관련 사진 추가</span>
                   <input type="file" accept="image/*" capture="environment" className="hidden" onChange={addRelatedPhoto} />
                </label>
             </div>
           </div>
        </div>
        )}

        {/* Guidelines */}
        <div className="break-before-page pt-4 print:pt-4 border-t-2 border-black">
          {renderChecklistGroup('필수이행지침', MUST_DO_GUIDELINES, '위험요소', '현장 확인사항')}
        </div>
        <div className="break-before-page pt-4 print:pt-4 border-t-2 border-black">
          {renderChecklistGroup('5대금지규정', FIVE_PROHIBITIONS, '위험요소', '현장 확인사항')}
        </div>
        <div className="break-before-page pt-4 print:pt-4 border-t-2 border-black">
          {renderChecklistGroup('위험성평가 상등급 감소대책 이행여부', highRiskItems, '작업공종', '유해위험요인/감소대책')}
        </div>
        <div className="break-before-page pt-4 print:pt-4 border-t-2 border-black border-b-2">
          {renderChecklistGroup('중점위험작업(PTW) 점검', PTW_INSPECTION, '종류', '점검사항')}
        </div>

      </div>
      </div>
    </div>
  );
}