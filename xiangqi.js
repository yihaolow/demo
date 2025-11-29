const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
  if (audioCtx.state === "suspended") audioCtx.resume();
  const t = audioCtx.currentTime;
  const mkOsc = (freq, type, dur, vol) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur);
  };
  if (type === "move" || type === "capture") {
    mkOsc(200, "sine", 0.15, 0.5);
    mkOsc(50, "square", 0.05, 0.2);
  } else if (type === "check") {
    mkOsc(800, "triangle", 0.6, 0.3);
  }
}

const CN_CHARS = { rR:"俥",rN:"傌",rE:"相",rA:"仕",rK:"帥",rC:"炮",rP:"兵", bR:"車",bN:"馬",bE:"象",bA:"士",bK:"將",bC:"炮",bP:"卒", "+":"进","-":"退","=":"平",F:"前",M:"中",B:"后" };
const CN_NUMS = ["零","一","二","三","四","五","六","七","八","九"];
const CN_DIGITS_FULL = ["０","１","２","３","４","５","６","７","８","９"];
function toCNFile(n,isRed){return isRed?CN_NUMS[n]:CN_DIGITS_FULL[n]}
function toCNNum(n,isRed){return isRed?CN_NUMS[n]:CN_DIGITS_FULL[n]}

class XiangqiEngine{
  constructor(){this.reset()}
  reset(){
    this.board=Array(10).fill(null).map(()=>Array(9).fill(null));
    this.turn="r";this.history=[];this.initialFen="rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1";
    this.loadFEN(this.initialFen)
  }
  getPiece(x,y){return(x<0||x>8||y<0||y>9)?null:this.board[y][x]}
  loadFEN(fen){
    this.board=Array(10).fill(null).map(()=>Array(9).fill(null));
    const parts=fen.split(" "),rows=parts[0].split("/"),map={R:"rR",N:"rN",B:"rE",A:"rA",K:"rK",C:"rC",P:"rP",r:"bR",n:"bN",b:"bE",a:"bA",k:"bK",c:"bC",p:"bP"};
    for(let y=0;y<10;y++){let x=0,row=rows[y]||"";
      for(let i=0;i<row.length;i++){let c=row[i];isNaN(c)?map[c]&&(this.board[y][x]=map[c],x++):x+=parseInt(c)}
    }
    this.turn=parts[1]==="b"?"b":"r";
    if(this.history.length===0)this.initialFen=fen
  }
  move(fx,fy,tx,ty){
    const p=this.getPiece(fx,fy);if(!p||p[0]!==this.turn)return{success:false};
    if(!this.validate(fx,fy,tx,ty,p))return{success:false};
    const wxf=this.getWXFNotation(fx,fy,tx,ty,p),cn=this.getChineseNotation(fx,fy,tx,ty,p),captured=this.board[ty][tx];
    this.board[ty][tx]=p;this.board[fy][fx]=null;
    if(this.isInCheck(this.turn)){this.board[fy][fx]=p;this.board[ty][tx]=captured;return{success:false}}
    this.history.push({fx,fy,tx,ty,captured,p,notation:wxf,cnNotation:cn});
    this.turn=this.turn==="r"?"b":"r";
    return{success:true,capture:!!captured,check:this.isInCheck(this.turn)}
  }
  undo(){if(!this.history.length)return false;const l=this.history.pop();this.board[l.fy][l.fx]=l.p;this.board[l.ty][l.tx]=l.captured;this.turn=l.p[0];return true}
  getValidMoves(fx,fy){
    const p=this.getPiece(fx,fy);if(!p||p[0]!==this.turn)return[];
    const m=[];for(let ty=0;ty<10;ty++)for(let tx=0;tx<9;tx++)if(this.validate(fx,fy,tx,ty,p)){
      const c=this.getPiece(tx,ty);this.board[ty][tx]=p;this.board[fy][fx]=null;
      if(!this.isInCheck(p[0]))m.push({x:tx,y:ty});
      this.board[fy][fx]=p;this.board[ty][tx]=c
    }
    return m
  }
  validate(fx,fy,tx,ty,p){
    if(fx===tx&&fy===ty)return false;
    const t=this.getPiece(tx,ty);if(t&&t[0]===p[0])return false;
    const dx=tx-fx,dy=ty-fy,ax=Math.abs(dx),ay=Math.abs(dy),type=p[1],isRed=p[0]==="r";
    switch(type){
      case"K":return tx>=3&&tx<=5&&(isRed?ty>=7:ty<=2)&&ax+ay===1;
      case"A":return tx>=3&&tx<=5&&(isRed?ty>=7:ty<=2)&&ax===1&&ay===1;
      case"E":return(isRed?ty>=5:ty<=4)&&ax===2&&ay===2&&!this.getPiece(fx+dx/2,fy+dy/2);
      case"N":return(ax===1&&ay===2&&!this.getPiece(fx,fy+(dy>0?1:-1)))||(ax===2&&ay===1&&!this.getPiece(fx+(dx>0?1:-1),fy));
      case"R":return(dx===0||dy===0)&&this.countObs(fx,fy,tx,ty)===0;
      case"C":const o=this.countObs(fx,fy,tx,ty);return(dx===0||dy===0)&&(t?o===1:o===0);
      case"P":const f=isRed?-1:1,c=isRed?fy<=4:fy>=5;return(dy===f&&dx===0)||(c&&dy===0&&ax===1);
    }
    return false
  }
  countObs(x1,y1,x2,y2){
    let cnt=0,dx=Math.sign(x2-x1),dy=Math.sign(y2-y1),x=x1+dx,y=y1+dy;
    if(dx!==0&&dy!==0)return-1;
    while(x!==x2||y!==y2){if(this.getPiece(x,y))cnt++;x+=dx;y+=dy}
    return cnt
  }
  isInCheck(c){
    const k=this.findPiece(c+"K");if(!k)return true;
    const op=c==="r"?"b":"r",opK=this.findPiece(op+"K");
    if(opK&&k.x===opK.x&&this.countObs(k.x,k.y,opK.x,opK.y)===0)return true;
    for(let y=0;y<10;y++)for(let x=0;x<9;x++){const p=this.board[y][x];if(p&&p[0]===op&&this.validate(x,y,k.x,k.y,p))return true}
    return false
  }
  findPiece(code){for(let y=0;y<10;y++)for(let x=0;x<9;x++)if(this.board[y][x]===code)return{x,y};return null}
  getWXFNotation(fx,fy,tx,ty,p){
    const isRed=p[0]==="r",sf=isRed?9-fx:fx+1,ef=isRed?9-tx:tx+1,col=[];
    for(let y=0;y<10;y++){const op=this.getPiece(fx,y);if(op===p)col.push(y)}
    col.sort((a,b)=>isRed?a-b:b-a);
    let pre="",uf=true,tc=p[1]==="N"?"H":p[1];
    if(col.length>1){uf=false;const i=col.indexOf(fy);pre=col.length===2?(i===0?"+":"-"):(i+1).toString()}
    let op="",dy=ty-fy;op=dy===0?".":(isRed&&dy<0)||(!isRed&&dy>0)?"+":"-";
    let tar=["R","C","P","K"].includes(p[1])&&op!=="."?Math.abs(dy).toString():ef.toString();
    return uf?tc+sf+op+tar:pre+tc+op+tar
  }
  getChineseNotation(fx,fy,tx,ty,p){
    const isRed=p[0]==="r",pn=CN_CHARS[p],sf=isRed?9-fx:fx+1,df=isRed?9-tx:tx+1,col=[];
    for(let y=0;y<10;y++){const op=this.getPiece(fx,y);if(op===p)col.push(y)}
    col.sort((a,b)=>isRed?a-b:b-a);
    let fs="";if(col.length>1){const i=col.indexOf(fy);
      if(col.length===2)fs=i===0?CN_CHARS.F:CN_CHARS.B;
      else if(col.length===3)fs=i===0?CN_CHARS.F:i===1?CN_CHARS.M:CN_CHARS.B;
      else fs=isRed?CN_NUMS[i+1]:CN_DIGITS_FULL[i+1];
      fs+=pn
    }else fs=pn+toCNFile(sf,isRed);
    let dir="",dest="",dy=ty-fy;
    if(dy===0){dir=CN_CHARS["="];dest=toCNNum(df,isRed)}
    else{dir=(isRed&&dy<0)||(!isRed&&dy>0)?CN_CHARS["+"]:CN_CHARS["-"];
      dest=["R","C","P","K"].includes(p[1])?toCNNum(Math.abs(dy),isRed):toCNNum(df,isRed)
    }
    return fs+dir+dest
  }
}

const engine=new XiangqiEngine();
let selected=null,validMoves=[];
const chars={rK:"帥",rA:"仕",rE:"相",rN:"傌",rR:"俥",rC:"炮",rP:"兵",bK:"將",bA:"士",bE:"象",bN:"馬",bR:"車",bC:"炮",bP:"卒"};

function render(){
  const l=document.getElementById("gridLayer");l.innerHTML="";
  for(let y=0;y<10;y++)for(let x=0;x<9;x++){
    const c=document.createElement("div");c.className="cell";c.style.left=x*11.11+"%";c.style.top=y*10+"%";c.onclick=()=>onCellClick(x,y);l.appendChild(c)
  }
  if(engine.history.length){
    const last=engine.history[engine.history.length-1];
    addMarker(l,last.fx,last.fy,"marker last");addMarker(l,last.tx,last.ty,"marker last")
  }
  if(selected)addMarker(l,selected.x,selected.y,"marker selected");
  validMoves.forEach(m=>addMarker(l,m.x,m.y,"marker valid"));
  for(let y=0;y<10;y++)for(let x=0;x<9;x++){
    const p=engine.getPiece(x,y);
    if(p){
      const d=document.createElement("div");
      d.className=`piece ${p[0]==="r"?"red":"black"}`;
      d.innerText=chars[p];
      d.style.left=x*11.11+5.55+"%";d.style.top=y*10+5+"%";
      l.appendChild(d)
    }
  }
}
function addMarker(p,x,y,c){
  const d=document.createElement("div");d.className=c;d.style.left=x*11.11+5.55+"%";d.style.top=y*10+5+"%";p.appendChild(d)
}
function onCellClick(x,y){
  const p=engine.getPiece(x,y),my=p&&p[0]===engine.turn;
  if(my){selected={x,y};validMoves=engine.getValidMoves(x,y);render();return}
  if(selected&&validMoves.some(m=>m.x===x&&m.y===y)){
    const r=engine.move(selected.x,selected.y,x,y);
    if(r.success){
      selected=null;validMoves=[];render();updateUI();
      if(r.check){playSound("check");splash()}
      else if(r.capture)playSound("capture");
      else playSound("move")
    }
  }else{selected=null;validMoves=[];render()}
}
function updateUI(){
  document.getElementById("status").innerText=(engine.turn==="r"?"Red":"Black")+"'s Turn";
  document.getElementById("status").style.color=engine.turn==="r"?"#ff5252":"#fff";
  const list=document.getElementById("moveHistory");list.innerHTML="";
  for(let i=0;i<engine.history.length;i+=2){
    const rm=engine.history[i],bm=engine.history[i+1],row=document.createElement("div");
    row.className="move-row";
    row.innerHTML=`<span style="color:#aaa;width:25px;">${i/2+1}.</span><span style="color:#ff5252;flex:1;">${rm?rm.notation:""}</span><span style="color:#eee;flex:1;text-align:right;">${bm?bm.notation:""}</span>`;
    list.appendChild(row)
  }
  list.scrollTop=list.scrollHeight
}
function splash(){
  const e=document.getElementById("splash");e.classList.remove("active");void e.offsetWidth;e.classList.add("active");
  setTimeout(()=>e.classList.remove("active"),1200)
}
const game={
  reset:()=>{engine.reset();selected=null;validMoves=[];render();updateUI();playSound("move")},
  undo:()=>{if(engine.undo()){selected=null;validMoves=[];render();updateUI();playSound("move")}},
  exportXQPro:()=>{let c="";engine.history.forEach(m=>c+=`${m.fx}${m.fy}${m.tx}${m.ty}`);const d={type:"XiangqiMaster_Save",fen:engine.initialFen,moves:c},b=new Blob([JSON.stringify(d)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="game.xqpro";document.body.appendChild(a);a.click();document.body.removeChild(a)},
  exportText:()=>{let t="开始局面: "+engine.initialFen+"\n着法: \n";for(let i=0;i<engine.history.length;i+=2){const rm=engine.history[i],bm=engine.history[i+1];t+=`${i/2+1}. ${rm.cnNotation}${bm?` ${bm.cnNotation}`:""}\n`}document.getElementById("ioInput").value=t},
  loadFile:e=>{const f=e.target.files[0];if(f){const r=new FileReader();r.onload=ev=>game.parse(ev.target.result);r.readAsText(f)}},
  loadFromInput:()=>game.parse(document.getElementById("ioInput").value),
  parse:t=>{
    let fen=engine.initialFen,ms="";
    try{const j=JSON.parse(t);if(j.type==="XiangqiMaster_Save"){fen=j.fen;ms=j.moves}}catch(e){
      const f=t.match(/_fen](.*?)\[/);if(f)fen=f[1];
      const m=t.match(/_movelist](.*?)\[/);if(m)ms=m[1];
      if(!m&&/^\d+$/.test(t.trim()))ms=t.trim()
    }
    engine.reset();engine.loadFEN(fen);engine.initialFen=fen;
    for(let i=0;i<ms.length;i+=4){
      const fx=parseInt(ms[i]),fy=parseInt(ms[i+1]),tx=parseInt(ms[i+2]),ty=parseInt(ms[i+3]),p=engine.getPiece(fx,fy);
      if(p){
        engine.board[ty][tx]=p;engine.board[fy][fx]=null;
        engine.history.push({fx,fy,tx,ty,captured:engine.getPiece(tx,ty),p,notation:engine.getWXFNotation(fx,fy,tx,ty,p),cnNotation:engine.getChineseNotation(fx,fy,tx,ty,p)});
        engine.turn=engine.turn==="r"?"b":"r"
      }
    }
    selected=null;validMoves=[];render();updateUI();playSound("move")
  }
};
render();updateUI();
