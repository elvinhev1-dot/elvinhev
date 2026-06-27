export interface DetectedFieldDTO {
  id: string;
  label: string;
  placeholder: string;
  inputType: 'text' | 'date' | 'textarea';
  example?: string;
  required: boolean;
  occurrences: number;
}

export interface TemplateDTO {
  id: string;
  name: string;
  originalFilename: string;
  createdAt: string;
  fields: DetectedFieldDTO[];
  /** Base64-encoded .docx content – stored client-side, never persisted on server */
  docxBase64: string;
}
