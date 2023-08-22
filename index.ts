import { fromEvent } from 'rxjs'; 
import { map,mergeMap,takeUntil,startWith,scan } from 'rxjs/operators';

/**
 * old-school event handling
 */
function mousedragEvents() {
  const svg = document.getElementById("svgCanvas")!;
  const rect = document.getElementById("draggableRect")!;
  rect.addEventListener('mousedown',e => {
    const
      xOffset = Number(rect.getAttribute('x')) - e.clientX,
      yOffset = Number(rect.getAttribute('y')) - e.clientY,
      moveListener = (e:MouseEvent)=>{
        rect.setAttribute('x',String(e.clientX + xOffset));
        rect.setAttribute('y',String(e.clientY + yOffset));
      },
      done = ()=>{
       svg.removeEventListener('mousemove', moveListener);
      };
    svg.addEventListener('mousemove', moveListener);
    svg.addEventListener('mouseup', done);
  })
}

/**
 * same logic with an Observable stream of events
 */
function mousedragObservable() {
  const svg = document.getElementById("svgCanvas")!;
  const rect = document.getElementById("draggableRect")!;

  const mousedown = fromEvent<MouseEvent>(rect,'mousedown'),
        mousemove = fromEvent<MouseEvent>(svg,'mousemove'),
        mouseup = fromEvent<MouseEvent>(svg,'mouseup');

  mousedown
    .pipe(
      map(({clientX, clientY}) => ({
        mouseDownXOffset: Number(rect.getAttribute('x')) - clientX,
        mouseDownYOffset: Number(rect.getAttribute('y')) - clientY
      })),
      mergeMap(({mouseDownXOffset, mouseDownYOffset}) =>
        mousemove
          .pipe(
            takeUntil(mouseup),
            map(({clientX, clientY}) => ({
                x: clientX + mouseDownXOffset,
                y: clientY + mouseDownYOffset
              })))))
   .subscribe(({x, y}) => {
     rect.setAttribute('x', String(x))
     rect.setAttribute('y', String(y))
   });
}

/**
 * Tidy up the stream logic such that all state is managed
 * by a pure function passed to scan.
 */
function pureObservableDragRect() {
  class Point {
    constructor(public readonly x: number, public readonly y: number) {}
    add(p: Point) { return new Point(this.x + p.x, this.y + p.y) }
    sub(p: Point) { return new Point(this.x - p.x, this.y - p.y) }}
  abstract class MousePosEvent extends Point {
    constructor(e: MouseEvent) { super(e.clientX, e.clientY) }
    abstract apply(s:State):State;
  }
  class DownEvent extends MousePosEvent {
    apply(s:State) { return { pos: s.pos, offset: s.pos.sub(this) }}
  }
  class DragEvent extends MousePosEvent {
    apply(s:State) { return { pos: this.add(s.offset), offset: s.offset }}
  }
  type State = Readonly<{
    pos: Point;
    offset?: Point;
  }>;
  const svg = document.getElementById('svgCanvas')!;
  const rect = document.getElementById('draggableRect')!;

  const mousedown = fromEvent<MouseEvent>(rect, 'mousedown'),
    mousemove = fromEvent<MouseEvent>(svg, 'mousemove'),
    mouseup = fromEvent<MouseEvent>(svg, 'mouseup');

  const initialState: State = { 
    pos: new Point(
      Number(rect.getAttribute('x')),
      Number(rect.getAttribute('y')))};

  mousedown
    .pipe(
      mergeMap(mouseDownEvent =>
        mousemove.pipe(
          takeUntil(mouseup),
          map((mouseDragEvent) => new DragEvent(mouseDragEvent)),
          startWith(new DownEvent(mouseDownEvent)))),
      scan((s, e) => e.apply(s), initialState)
    )
    .subscribe((e) => {
      rect.setAttribute('x', String(e.pos.x));
      rect.setAttribute('y', String(e.pos.y));
    });
}
setTimeout(pureObservableDragRect);
