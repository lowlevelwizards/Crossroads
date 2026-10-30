"use strict";
(() => {
  const clone=x=>JSON.parse(JSON.stringify(x));
  function create(initial,limit=70){
    let current=clone(initial),undoStack=[],redoStack=[],starting=null;
    const notify=[];
    const publish=()=>notify.forEach(fn=>fn(clone(current)));
    return Object.freeze({
      get:()=>clone(current),
      subscribe:fn=>notify.push(fn),
      begin:()=>{if(starting===null)starting=clone(current)},
      update:next=>{current=clone(next);publish()},
      commit:()=>{
        if(starting!==null&&JSON.stringify(current)!==JSON.stringify(starting)){
          undoStack.push(starting);if(undoStack.length>limit)undoStack.shift();
          redoStack=[];starting=null;publish();return true;
        }
        starting=null;return false;
      },
      transact:fn=>{
        if(starting!==null)throw Error("Finish active drag first");
        const before=clone(current);
        const after=fn(clone(current));
        if(JSON.stringify(before)===JSON.stringify(after))return;
        undoStack.push(before);if(undoStack.length>limit)undoStack.shift();
        redoStack=[];current=clone(after);publish();
      },
      undo:()=>{
        if(!undoStack.length)return false;
        redoStack.push(clone(current));current=undoStack.pop();
        starting=null;publish();return true;
      },
      redo:()=>{
        if(!redoStack.length)return false;
        undoStack.push(clone(current));current=redoStack.pop();
        starting=null;publish();return true;
      },
      canUndo:()=>undoStack.length>0,
      canRedo:()=>redoStack.length>0
    });
  }
  window.Crossroads3DShapeHistory=Object.freeze({create});
})();