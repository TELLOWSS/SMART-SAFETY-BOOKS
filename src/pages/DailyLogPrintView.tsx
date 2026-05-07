/**
 * 인쇄/PDF 전용 정적 뷰 컴포넌트
 * - 편집 UI(input, textarea, select, button 등) 없음
 * - 화면 작성 양식과 동일한 레이아웃, 동일한 데이터를 순수 텍스트/표로 표시
 * - window.print() 시 화면에 보이는 그대로 출력됨
 */
import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/auth';
import { DailyLog, ChecklistData, RelatedPhoto } from '../lib/types';
import { MUST_DO_GUIDELINES, FIVE_PROHIBITIONS, HIGH_RISK_ASSESSMENTS, PTW_INSPECTION } from '../lib/checklistTypes';

interface Props {
  logId: string;
}

export default function DailyLogPrintView({ logId }: Props) {
  const [log, setLog] = useState<DailyLog | null>(null);
  const [checklist, setChecklist] = useState<ChecklistData>({});
  const [relatedPhotos, setRelatedPhotos] = useState<RelatedPhoto[]>([]);
  const [highRiskItems, setHighRiskItems] = useState(HIGH_RISK_ASSESSMENTS);
  const [hiddenSections, setHiddenSections] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!logId || !auth.currentUser) return;
      try {
        const snap = await getDoc(doc(db, 'logs', logId));
        if (snap.exists()) {
          const data = snap.data() as Omit<DailyLog, 'id'>;
          setLog({ id: snap.id, ...data });
          if (data.checklistData) setChecklist(JSON.parse(data.checklistData));
          if (data.relatedPhotosData) setRelatedPhotos(JSON.parse(data.relatedPhotosData));
          if ((data as any).hiddenSections) setHiddenSections((data as any).hiddenSections);
        }

        // 사용자 위험성평가 설정 로드
        const uid = auth.currentUser?.uid;
        if (uid) {
          const riskSnap = await getDoc(doc(db, 'settings', `risk_assessment_${uid}`));
          if (riskSnap.exists() && riskSnap.data()?.items) {
            setHighRiskItems(riskSnap.data()!.items);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [logId]);

  if (loading) return <div className="text-center p-8 text-neutral-400">일지 로딩 중...</div>;
  if (!log) return <div className="text-center p-8 text-neutral-400">일지를 찾을 수 없습니다.</div>;

  // 줄바꿈 텍스트를 <br/>으로 렌더링
  const multiline = (text: string) =>
    text ? text.split('\n').map((line, i) => <React.Fragment key={i}>{line}{i < text.split('\n').length - 1 && <br />}</React.Fragment>) : null;

  // 체크리스트 섹션 렌더러 (완전 정적)
  const renderChecklistSection = (
    title: string,
    items: any[],
    firstColTitle: string,
    secondColTitle: string
  ) => {
    if (hiddenSections[title]) return null;

    return (
      <div className="border-2 border-black mb-0 break-inside-avoid" style={{ fontFamily: 'serif' }}>
        {/* 섹션 제목 */}
        <div className="border-b-2 border-black bg-neutral-100 font-bold text-base text-center py-2">
          {title}
        </div>

        {/* 헤더 행 */}
        <div className="grid border-b border-black text-center font-bold text-sm bg-neutral-50"
          style={{ gridTemplateColumns: '100px 1fr 140px 1.2fr' }}>
          <div className="border-r border-black p-2 flex items-center justify-center">{firstColTitle}</div>
          <div className="border-r border-black flex flex-col">
            {secondColTitle === '유해위험요인/감소대책' ? (
              <>
                <div className="flex-1 border-b border-black p-2 flex items-center justify-center">유해위험요인</div>
                <div className="flex-1 p-2 flex items-center justify-center">감소대책</div>
              </>
            ) : (
              <div className="flex-1 p-2 flex items-center justify-center">{secondColTitle}</div>
            )}
          </div>
          <div className="border-r border-black p-2 flex items-center justify-center">점검사진</div>
          <div className="p-2 flex items-center justify-center">점검내용</div>
        </div>

        {/* 내용 행들 */}
        {items.map((item, index) => {
          const rowHiddenId = `${title}_${item.id}`;
          if (hiddenSections[rowHiddenId]) return null;

          const val = checklist[item.id] || { status: 'N/A', action: '', photoUrl: '' };
          const isLast = index === items.length - 1;
          const categoryText = val.category !== undefined ? val.category : item.category;
          const hazardTopText = val.hazardTop !== undefined ? val.hazardTop : item.hazardTop;
          const hazardBottomText = val.hazardBottom !== undefined ? val.hazardBottom : item.hazardBottom;
          const hazardText = val.hazard !== undefined ? val.hazard : item.hazard;

          return (
            <div
              key={item.id}
              className={`grid text-sm break-inside-avoid ${!isLast ? 'border-b border-black' : ''}`}
              style={{ gridTemplateColumns: '100px 1fr 140px 1.2fr', minHeight: '100px' }}
            >
              {/* 구분/공종 */}
              <div className="border-r border-black p-2 flex items-center justify-center text-center font-medium break-words">
                {categoryText}
              </div>

              {/* 위험요인/감소대책 */}
              <div className="border-r border-black flex flex-col text-center">
                {item.hazardTop !== undefined ? (
                  <>
                    <div className="flex-1 p-2 border-b border-black flex items-start justify-center whitespace-pre-wrap break-words leading-relaxed">
                      {multiline(hazardTopText || '')}
                    </div>
                    <div className="flex-1 p-2 flex items-start justify-center whitespace-pre-wrap break-words leading-relaxed">
                      {multiline(hazardBottomText || '')}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 p-2 flex items-start justify-center whitespace-pre-wrap break-words leading-relaxed">
                    {multiline(hazardText || '')}
                  </div>
                )}
              </div>

              {/* 점검 사진 */}
              <div className="border-r border-black flex items-center justify-center bg-white p-1">
                {val.photoUrl ? (
                  <img
                    src={val.photoUrl}
                    alt="점검사진"
                    className="max-w-full max-h-[130px] object-contain"
                  />
                ) : (
                  <span className="text-neutral-300 text-xs font-semibold">N/A</span>
                )}
              </div>

              {/* 점검내용 */}
              <div className="p-2 flex flex-col gap-1">
                {val.status && val.status !== 'N/A' && val.status !== '미해당' && (
                  <span className={`font-bold text-sm ${val.status === '양호' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    [{val.status}]
                  </span>
                )}
                {val.status === '미해당' && (
                  <span className="font-bold text-sm text-neutral-500">[미해당]</span>
                )}
                <div className="whitespace-pre-wrap leading-relaxed text-sm">
                  {multiline(val.action || '')}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="print-form-root bg-white mx-auto text-neutral-900 border-2 border-black w-full break-keep"
      style={{ fontFamily: 'serif', wordBreak: 'keep-all' }}
    >
      {/* ─── 제목 & 결재란 ─── */}
      <div className="flex justify-between items-stretch border-b-2 border-black">
        <div className="flex-1 flex items-center justify-center p-4">
          <h1 className="text-3xl font-bold tracking-[0.2em] whitespace-nowrap">
            안전전담자(관리자) 운영일지
          </h1>
        </div>
        <div className="w-56 border-l-2 border-black flex">
          <div className="w-8 flex flex-col items-center justify-center border-r border-black font-bold text-sm bg-neutral-50 gap-2 py-2">
            <span>결</span><span>재</span>
          </div>
          <div className="flex-1 flex flex-col">
            <div className="flex bg-neutral-50 border-b border-black font-bold text-sm">
              <div className="flex-1 py-1 flex items-center justify-center border-r border-black">담당</div>
              <div className="flex-1 py-1 flex items-center justify-center">소장</div>
            </div>
            <div className="flex flex-1 min-h-[60px]">
              <div className="flex-1 border-r border-black flex items-center justify-center">
                {log.managerSignature && (
                  <img src={log.managerSignature} alt="담당서명" className="max-w-full max-h-full p-1 object-contain mix-blend-multiply" />
                )}
              </div>
              <div className="flex-1 flex items-center justify-center">
                {log.directorSignature && (
                  <img src={log.directorSignature} alt="소장서명" className="max-w-full max-h-full p-1 object-contain mix-blend-multiply" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 상단 기본 정보 ─── */}
      {!hiddenSections['top'] && (
        <>
          {/* 일자 */}
          <div className="flex border-b-2 border-black">
            <div className="w-24 flex items-center justify-center border-r-2 border-black font-semibold shrink-0 py-2">
              일 자
            </div>
            <div className="flex-1 p-2 text-lg font-medium">{log.date}</div>
          </div>

          {/* 출역인원 */}
          <div className="flex border-b-2 border-black">
            <div className="w-24 flex items-center justify-center border-r-2 border-black font-semibold shrink-0">
              출역인원
            </div>
            <div className="flex-1 flex flex-col">
              <div className="flex border-b border-black font-semibold text-sm">
                <div className="flex-1 p-2 text-center border-r border-black">구 분</div>
                <div className="flex-1 p-2 text-center border-r border-black">직원</div>
                <div className="flex-1 p-2 text-center border-r border-black">근로자</div>
                <div className="flex-1 p-2 text-center">계</div>
              </div>
              <div className="flex font-semibold text-sm">
                <div className="flex-1 p-2 text-center border-r border-black">일 계</div>
                <div className="flex-1 p-2 text-center border-r border-black">{log.workerStaff}</div>
                <div className="flex-1 p-2 text-center border-r border-black">{log.workerLaborer}</div>
                <div className="flex-1 p-2 text-center bg-neutral-50">{log.workerStaff + log.workerLaborer}</div>
              </div>
            </div>
          </div>

          {/* 주요 작업내용 */}
          <div className="flex border-b-2 border-black min-h-[200px]">
            <div className="w-24 flex items-center justify-center border-r-2 border-black font-semibold shrink-0">
              <div className="text-center w-8">주요<br />작업<br />내용</div>
            </div>
            <div className="flex-1 p-4 whitespace-pre-wrap leading-relaxed">{log.tasks}</div>
          </div>

          {/* 위험요소 & 시정조치 */}
          <div className="flex border-b-2 border-black min-h-[180px] break-inside-avoid">
            <div className="flex-1 flex flex-col border-r border-black">
              <div className="font-semibold text-center p-2 border-b border-black">위 험 요 소 (지 적 사 항)</div>
              <div className="flex-1 p-4 whitespace-pre-wrap leading-relaxed">{log.hazardsText}</div>
            </div>
            <div className="flex-1 flex flex-col">
              <div className="font-semibold text-center p-2 border-b border-black">시 정 조 치 (건 의 사 항)</div>
              <div className="flex-1 p-4 whitespace-pre-wrap leading-relaxed">{log.actionsText}</div>
            </div>
          </div>

          {/* 교육행사 & 기타사항 */}
          <div className="flex flex-col border-b-2 border-black break-inside-avoid">
            <div className="flex border-b border-black">
              <div className="w-48 p-2 border-r border-black text-center font-semibold">교육행사</div>
              <div className="flex-1 p-2">{log.education}</div>
            </div>
            <div className="flex">
              <div className="w-48 p-2 border-r border-black text-center font-semibold">기타사항</div>
              <div className="flex-1 p-2">{log.others}</div>
            </div>
          </div>
        </>
      )}

      {/* ─── 관련 사진 ─── */}
      {!hiddenSections['관련사진'] && relatedPhotos.length > 0 && (
        <div className="break-before-page pt-4">
          <div className="border-t-2 border-b-2 border-black p-2 flex items-center justify-center">
            <h2 className="text-2xl font-bold text-center tracking-[1em]">관 련 사 진</h2>
          </div>
          <div className="grid grid-cols-2 gap-0 border-b border-black">
            {relatedPhotos.map((photo, index) => {
              const isEven = index % 2 === 0;
              return (
                <div
                  key={photo.id}
                  className={`flex flex-col border-black bg-white break-inside-avoid border-b ${isEven ? 'border-r' : ''}`}
                >
                  <div className="aspect-[4/3] w-full relative bg-neutral-100 flex-shrink-0 border-b border-black overflow-hidden">
                    {photo.imageUrl ? (
                      <img src={photo.imageUrl} alt="현장사진" className="absolute inset-0 w-full h-full object-contain" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm">사진 없음</div>
                    )}
                  </div>
                  <div className="flex border-b border-black text-sm">
                    <div className="w-16 p-1.5 flex items-center justify-center border-r border-black bg-neutral-50 font-semibold">날짜</div>
                    <div className="w-24 p-1.5 flex items-center justify-center border-r border-black">{photo.date}</div>
                    <div className="w-16 p-1.5 flex items-center justify-center border-r border-black bg-neutral-50 font-semibold">위치</div>
                    <div className="flex-1 p-1.5 flex items-center">{photo.location}</div>
                  </div>
                  <div className="flex text-sm min-h-[60px]">
                    <div className="w-16 p-2 flex items-center justify-center border-r border-black bg-neutral-50 font-semibold shrink-0">지적사항</div>
                    <div className="flex-1 p-2 whitespace-pre-wrap leading-relaxed">{photo.issue}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 체크리스트 섹션들 ─── */}
      {!hiddenSections['필수이행지침'] && (
        <div className="break-before-page pt-4 border-t-2 border-black">
          {renderChecklistSection('필수이행지침', MUST_DO_GUIDELINES, '위험요소', '현장 확인사항')}
        </div>
      )}
      {!hiddenSections['5대금지규정'] && (
        <div className="break-before-page pt-4 border-t-2 border-black">
          {renderChecklistSection('5대금지규정', FIVE_PROHIBITIONS, '위험요소', '현장 확인사항')}
        </div>
      )}
      {!hiddenSections['위험성평가 상등급 감소대책 이행여부'] && (
        <div className="break-before-page pt-4 border-t-2 border-black">
          {renderChecklistSection('위험성평가 상등급 감소대책 이행여부', highRiskItems, '작업공종', '유해위험요인/감소대책')}
        </div>
      )}
      {!hiddenSections['중점위험작업(PTW) 점검'] && (
        <div className="break-before-page pt-4 border-t-2 border-black border-b-2">
          {renderChecklistSection('중점위험작업(PTW) 점검', PTW_INSPECTION, '종류', '점검사항')}
        </div>
      )}
    </div>
  );
}
