declare module 'foliate-js/view.js' {
  export const makeBook: (file: any) => Promise<any>;
}

declare module 'foliate-js/overlayer.js' {
  export class Overlayer {
    element: SVGElement;
    add(key: string, range: Range | ((root: Node) => Range), draw: (rects: DOMRectList, options?: any) => SVGElement, options?: any): void;
    remove(key: string): void;
    redraw(): void;
    hitTest(coords: { x: number; y: number }): [string, Range] | [];
    static underline(rects: DOMRectList, options?: any): SVGElement;
    static strikethrough(rects: DOMRectList, options?: any): SVGElement;
    static squiggly(rects: DOMRectList, options?: any): SVGElement;
    static highlight(rects: DOMRectList, options?: any): SVGElement;
    static outline(rects: DOMRectList, options?: any): SVGElement;
  }
}

declare module 'foliate-js/epub.js';
declare module 'foliate-js/epubcfi.js';
declare module 'foliate-js/paginator.js';
declare module 'foliate-js/search.js';
declare module 'foliate-js/progress.js';
declare module 'foliate-js/tts.js';
