export type ResourceType =
  | 'book'
  | 'video'
  | 'simulation'
  | 'past_paper'
  | 'teacher_guide'
  | 'interactive';

export interface LibraryResource {
  id: string;
  title: string;
  resourceType: ResourceType;
  subject: string;
  gradeLevel: string | null;
  description: string | null;
  storageKey: string;
  tags: string[];
  createdBy: string;
}
