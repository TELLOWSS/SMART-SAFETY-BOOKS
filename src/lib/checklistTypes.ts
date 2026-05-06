export const MUST_DO_GUIDELINES = [
  { id: 'fall_1', category: '추락', hazard: '추락 위험장소 작업시 작업발판과 안전난간 설치 여부' },
  { id: 'fall_2', category: '추락', hazard: '2m이상 고소작업시 전체식 안전대 착용, 안전대 걸이시설 설치 여부' },
  { id: 'machinery_1', category: '건설기계', hazard: '건설기계 작업 반경 내 근로자의 출입통제 이행여부' },
  { id: 'falling_1', category: '낙하물', hazard: '인양작업시 근로자 통제구역 설정 인양물 하부 출입금지 조치 여부' },
  { id: 'confined_1', category: '밀폐공간', hazard: '밀폐공간 작업시 작업 전 산소농도 측정 실시 여부' },
  { id: 'hotwork_1', category: '화기작업', hazard: '화기 작업시 작업 반경 내 인화성 물질 제거 소화기 비치 여부' }
];

export const FIVE_PROHIBITIONS = [
  { id: 'smoke_1', category: '흡연', hazard: '흡연구역 외 흡연 금지 여부' },
  { id: 'earphone_1', category: '이어폰', hazard: '작업/이동 중 이어폰 착용 금지 여부' },
  { id: 'phone_1', category: '휴대폰', hazard: '건설기계/장비 조작 중 휴대폰 사용금지 여부' },
  { id: 'tbm_1', category: 'TBM', hazard: 'TBM 미참석자 작업 투입 금지 여부' },
  { id: 'permit_1', category: '작업허가', hazard: '허가되지 않은 작업 금지 여부' }
];

export const PTW_INSPECTION = [
  { id: 'ptw_1', category: '밀폐작업', hazard: 'PTW, 비상연락망 MSDS, 비치 확인' },
  { id: 'ptw_2', category: '밀폐작업', hazard: '작업 전 산소농도 측정 실시 여부' },
  { id: 'ptw_3', category: '화기작업', hazard: '화기 작업시 작업 반경 내 인화성 물질 제거 소화기 비치 여부' },
  { id: 'ptw_4', category: '고소작업', hazard: '2m이상 고소작업시 전체식 안전대 착용, 안전대 걸이시설 설치 여부' }
];

export const HIGH_RISK_ASSESSMENTS = [
  { 
    id: 'risk_1', 
    category: '시스템/써포트', 
    hazardTop: '시스템 동바리 설치 작업중 작업 발판 미설치 또는 작업발판 고정불량으로 인한 이동중 추락사고위험.', 
    hazardBottom: '안전보호구착용상태 점검,통로 설치 및 작업발판 고정 확인후 작업자 투입 및 상부작업자 안전고리 체결 철저 후 작업'
  },
  { 
    id: 'risk_2', 
    category: '전체', 
    hazardTop: '단부 근접구간 및 고소작업시 개인보호구 미착용 및 안전고리 미체결로 인한 떨어질 위험',
    hazardBottom: '단부 근접구간 작업자는 사전 개인보호구 착용 및 안전고리 체결후 작업실시'
  },
  { 
    id: 'risk_3', 
    category: '직영/타설', 
    hazardTop: '동절기 보양 작섭시 산소결핍 및 유해가스 중독에 의한 근로자 질식 위험 .',
    hazardBottom: '작업전 PTW제출(1일) 및 특별안전보건교육 실시 작업전 소화기,PTW,비상연락망MSDS,안전장비 비치여부등 확인 작업 투입전 산소 및 유해가스 농도 측정 철저 밀폐공간 경고표지 비치, 타근로자 출입금지,단독작업금지, 종료시간 철저 MSDS경고표지 부착 철저'
  }
];

export interface ChecklistItemStatus {
  status: 'N/A' | '양호' | '불량' | '미해당';
  action: string;
}

export type ChecklistData = Record<string, ChecklistItemStatus>;
