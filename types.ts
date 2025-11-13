export interface VideoFile {
  id: string;
  url: string;
  thumbnail: string;
  title: string;
  description: string;
  keywords: string[];
  categories: string[];
  price: number;
  width?: number;
  height?: number;
  commercialAppeal: number; // Score from 1-100 predicted by AI
  isFeatured: boolean;     // Manually set by the admin
  isFree: boolean;         // Manually set by the admin
  createdAt: number;       // Timestamp for "Newest" sorting
}

export interface Category {
  id: string; // Document ID from Firestore
  name: string;
  isHidden: boolean;
}
