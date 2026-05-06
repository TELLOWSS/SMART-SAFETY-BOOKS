export interface DailyLog {
  id: string;
  ownerId: string;
  date: string;
  workerStaff: number;
  workerLaborer: number;
  tasks: string;
  education: string;
  others: string;
  aiSummary: string;
  hazardsText: string;
  actionsText: string;
  checklistData: string;
  relatedPhotosData: string;
  managerSignature?: string;
  directorSignature?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RelatedPhoto {
  id: string;
  date: string;
  location: string;
  issue: string;
  imageUrl: string; 
}

export type ChecklistData = Record<string, {
  status: 'N/A' | '양호' | '불량' | '미해당';
  action: string;
  photoUrl?: string; // Base64
  category?: string;
  hazard?: string;
  hazardTop?: string;
  hazardBottom?: string;
}>;

export interface Notification {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: number;
}
