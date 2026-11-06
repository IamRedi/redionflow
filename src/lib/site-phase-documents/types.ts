export const DOCUMENT_PHASES = ['piketim','rilevim','projektim','porosi','prodhimi','montimi'] as const;
export type DocumentPhase = typeof DOCUMENT_PHASES[number];
export type PhaseDocumentView = {
  id:string;phase:DocumentPhase;title:string;note:string;fileName:string;mime:string;size:number;
  uploadedBy:string;uploadedAt:string;supersedesId:string|null;archivedAt:string|null;canEdit:boolean;
  receipts:{name:string;at:string;mine:boolean}[];
};
export type PhaseDocumentSnapshot = {documents:PhaseDocumentView[];actorName:string};
