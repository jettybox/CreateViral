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
  // FIX: Add optional generatedThumbnail property to align with its usage in CartPanel and PurchasesPanel.
  generatedThumbnail?: string;
}
