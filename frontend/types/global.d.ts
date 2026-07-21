// global.d.ts
export {};

declare global {
  interface Window {
    __gridPopupTab: (tabId: string, btn: HTMLElement) => void;
    __closeGridPopupDrawer: (drawerId: string) => void;
    __saveGlobePin?: (lat: number, lng: number) => void;
  }
}