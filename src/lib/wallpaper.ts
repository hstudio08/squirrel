import { get, set, del } from 'idb-keyval';

export interface WallpaperSettings {
  type: 'preset' | 'custom' | 'none';
  id: string; // e.g. 'wp1.jpg' or custom id
  opacity: number;
  blur: number;
}

export const defaultSettings: WallpaperSettings = {
  type: 'preset',
  id: 'wp1.jpg', // default to first wallpaper
  opacity: 100,
  blur: 0
};

export async function getWallpaperSettings(): Promise<WallpaperSettings> {
  if (typeof window === 'undefined') return defaultSettings;
  const stored = localStorage.getItem('squirrel_wallpaper_settings');
  if (stored) {
    try {
      return { ...defaultSettings, ...JSON.parse(stored) };
    } catch(e) {}
  }
  return defaultSettings;
}

export function saveWallpaperSettings(settings: WallpaperSettings) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('squirrel_wallpaper_settings', JSON.stringify(settings));
    window.dispatchEvent(new Event('squirrel-wallpaper-changed'));
  }
}

export async function saveCustomWallpaper(file: File): Promise<string> {
  const id = `custom_wp_${Date.now()}`;
  await set(id, file);
  
  const customList = await get<string[]>('squirrel_custom_wallpapers') || [];
  customList.push(id);
  await set('squirrel_custom_wallpapers', customList);
  
  return id;
}

export async function getCustomWallpapers(): Promise<{id: string, url: string}[]> {
  const customList = await get<string[]>('squirrel_custom_wallpapers') || [];
  const result = [];
  for (const id of customList) {
    const file = await get<File>(id);
    if (file) {
      result.push({ id, url: URL.createObjectURL(file) });
    }
  }
  return result;
}

export async function deleteCustomWallpaper(id: string) {
  await del(id);
  const customList = await get<string[]>('squirrel_custom_wallpapers') || [];
  const newList = customList.filter(x => x !== id);
  await set('squirrel_custom_wallpapers', newList);
}

export async function getWallpaperUrl(settings: WallpaperSettings): Promise<string | null> {
  if (settings.type === 'none') return null;
  if (settings.type === 'preset') return `/wallpapers/${settings.id}`;
  if (settings.type === 'custom') {
    const file = await get<File>(settings.id);
    if (file) return URL.createObjectURL(file);
  }
  return null;
}
