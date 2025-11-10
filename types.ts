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
  createdAt: number;       // Timestamp for "Newest" sorting
  generatedThumbnail?: string; // Base64 data URL for thumbnails generated on the fly
}
