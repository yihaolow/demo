/** AUDIO */
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

/** CHINESE NOTATION */
const CN_CHARS = {
  rR: "俥", rN: "傌", rE: "相", rA: "仕", rK: "帥", rC: "炮", rP: "兵",
  bR: "車", bN: "馬", bE: "象", bA: "士", bK: "將", bC: "炮", bP: "卒",
  "+": "进", "-": "退", "=": "平", F: "前", M: "中", B: "后"
};
const CN_NUMS = ["零","一","二","三","四","五","六","七","八","九"];
const CN_DIGITS_FULL = ["０","１","２","３","４","５","６","７","８","９"];
function toCNFile(n, isRed) { return isRed ? CN_NUMS[n] : CN_DIGITS_FULL[n]; }
function toCNNum(n, isRed) { return isRed ? CN_NUMS[n] : CN_DIGITS_FULL[n]; }

class XiangqiEngine {
  constructor() { this.reset(); }
  reset() {
    this.board = Array(10).fill(null).map(() => Array(9).fill(null));
    this.turn = "r";
    this.history = [];
    this.initialFen = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1";
    this.loadFEN(this.initialFen);
  }
  getPiece(x, y) { return (x < 0 || x > 8 || y < 0 || y > 9) ? null : this.board[y][x]; }
  loadFEN(fen) {
    this.board = Array(10).fill(null).map(() => Array(9).fill(null));
    const parts = fen.split(" ");
    const rows = parts[0].split("/");
    const map = { R:"rR",N:"rN",B:"rE",A:"rA",K:"rK",C:"rC",P:"rP", r:"bR",n:"bN",b:"bE",a:"bA",k:"bK",c:"bC",p:"bP" };
    for (let y = 0; y < 10; y++) {
      let x = 0;
      const row = rows[y] || "";
      for (let i = 0; i < row.length; i++) {
        const c = row[i];
        if (!isNaN(c)) x += parseInt(c);
        else { if (map[c]) this.board[y][x] = map[c]; x++; }
      }
    }
    this.turn = parts[1] === "b" ? "b" : "r";
    if (this.history.length === 0) this.initialFen = fen;
  }
  move(fx, fy, tx, ty) {
    const p = this.getPiece(fx, fy);
    if (!p || p[0] !== this.turn) return { success: false };
    if (!this.validate(fx, fy, tx, ty, p)) return { success: false };
    const wxf = this.getWXFNotation(fx, fy, tx, ty, p);
    const cn = this.getChineseNotation(fx, fy, tx, ty, p);
    const captured = this.board[ty][tx];
    this.board[ty][tx] = p;
    this.board[fy][fx] = null;
    if (this.isInCheck(this.turn)) {
      this.board[fy][fx] = p;
      this.board[ty][tx] = captured;
      return { success: false };
    }
    this.history.push({ fx, fy, tx, ty, captured, p, notation: wxf, cnNotation: cn });
    this.turn = this.turn === "r" ? "b" : "r";
    return { success: true, capture: !!captured, check: this.isInCheck(this.turn) };
  }
  undo() {
    if (!this.history.length) return false;
    const last = this.history.pop();
    this.board[last.fy][last.fx] = last.p;
    this.board[last.ty][last.tx] = last.captured;
    this.turn = last.p[0];
    return true;
  }
  getValidMoves(fx, fy) {
    const p = this.getPiece(fx, fy);
    if (!p || p[0] !== this.turn) return [];
    const moves = [];
    for (let ty = 0; ty < 10; ty++)
      for (let tx = 0; tx < 9; tx++)
        if (this.validate(fx, fy, tx, ty, p)) {
          const captured = this.getPiece(tx, ty);
          this.board[ty][tx] = p;
          this.board[fy][fx] = null;
          if (!this.isInCheck(p[0])) moves.push({ x: tx, y: ty });
          this.board[fy][fx] = p;
          this.board[ty][tx] = captured;
        }
    return moves;
  }
  validate(fx, fy, tx, ty, p) {
    if (fx === tx && fy === ty) return false;
    const target = this.getPiece(tx, ty);
    if (target && target[0] === p[0]) return false;
    const dx = tx - fx, dy = ty - fy, ax = Math.abs(dx), ay = Math.abs(dy);
    const type = p[1], isRed = p[0] === "r";
    switch (type) {
      case "K": return tx >= 3 && tx <= 5 && (isRed ? ty >= 7 : ty <= 2) && ax + ay === 1;
      case "A": return tx >= 3 && tx <= 5 && (isRed ? ty >= 7 : ty <= 2) && ax === 1 && ay === 1;
      case "E": return (isRed ? ty >= 5 : ty <= 4) && ax === 2 && ay === 2 && !this.getPiece(fx + dx/2, fy + dy/2);
      case "N": return (ax===1 && ay===2 && !this.getPiece(fx, fy+(dy>0?1:-1))) || (ax===2 && ay===1 && !this.getPiece(fx+(dx>0?1:-1), fy));
      case "R": return (dx===0 || dy===0) && this.countObs(fx,fy,tx,ty)===0;
      case "C": { const obs=this.countObs(fx,fy,tx,ty); return (dx===0 || dy===0) && (target?obs===1:obs===0); }
      case "P": { const forward=isRed?-1:1; const crossed=isRed?fy<=4:fy>=5; return (dy===forward && dx===0) || (crossed && dy===0 && ax===1); }
    }
    return false;
  }
  countObs(x1,y1,x2,y2) {
    let cnt=0, dx=Math.sign(x2-x1), dy=Math.sign(y2-y1);
    let x=x1+dx, y=y1+dy;
    if (dx!==0 && dy!==0) return -1;
    while (x!==x2 || y!==y2) { if (this.getPiece(x,y)) cnt++; x+=dx; y+=dy; }
    return cnt;
  }
  isInCheck(c) {
    const k=this.findPiece(c+"K"); if (!k) return true;
    const op=c==="r"?"b":"r";
    const opK=this.findPiece(op+"K");
    if (opK && k.x===opK.x && this.countObs(k.x,k.y,opK.x,opK.y)===0) return true;
    for (let y=0;y<10;y++) for (let x=0;x<9;x++) {
      const p=this.board[y][x];
      if (p && p[0]===op && this.validate(x,y,k.x,k.y,p)) return true;
    }
    return false;
  }
  findPiece(code) {
    for (let y=0;y<10;y++) for (let x=0;x<9;x++) if (this.board[y][x]===code) return {x,y};
    return null;
  }
  getWXFNotation(fx,fy,tx,ty,p) {
    const isRed=p[0]==="r";
    const startFile=isRed?9-fx:fx+1;
    const endFile=isRed?9-tx:tx+1;
    const col=[]; for (let y=0;y<10;y++) { const op=this.getPiece(fx,y); if (op===p) col.push(y); }
    col.sort((a,b)=>isRed?a-b:b-a);
    let prefix="", useFile=true;
    const typeChar=p[1]==="N"?"H":p[1];
    if (col.length>1) { useFile=false; const idx=col.indexOf(fy); prefix=col.length===2?(idx===0?"+":"-"):(idx+1).toString(); }
    let op="", dy=ty-fy;
    op=dy===0?".":(isRed&&dy<0)||(!isRed&&dy>0)?"+":"-";
    let target=["R","C","P","K"].includes(p[1])&&op!=="."?Math.abs(dy).toString():endFile.toString();
    return useFile?`${typeChar}${startFile}${op}${target}`:`${prefix}${typeChar}${op}${target}`;
  }
  getChineseNotation(fx,fy,tx,ty,p) {
    const isRed=p[0]==="r";
    const pName=CN_CHARS[p];
    const srcFile=isRed?9-fx:fx+1;
    const dstFile=isRed?9-tx:tx+1;
    const col=[]; for (let y=0;y<10;y++) { const op=this.getPiece(fx,y); if (op===p) col.push(y); }
    col.sort((a,b)=>isRed?a-b:b-a);
    let fileStr="";
    if (col.length>1) {
      const idx=col.indexOf(fy);
      if (col.length===2) fileStr=idx===0?CN_CHARS.F:CN_CHARS.B;
      else if (col.length===3) fileStr=idx===0?CN_CHARS.F:idx===1?CN_CHARS.M:CN_CHARS.B;
      else fileStr=isRed?CN_NUMS[idx+1]:CN_DIGITS_FULL[idx+1];
      fileStr+=pName;
    } else fileStr=pName+toCNFile(srcFile,isRed);
    let dirStr="", destStr="";
    const dy=ty-fy;
    if (dy===0) { dirStr=CN_CHARS["="]; destStr=toCNNum(dstFile,isRed); }
    else {
      dirStr=(isRed&&dy<0)||(!isRed&&dy>0)?CN_CHARS["+"]:CN_CHARS["-"];
      destStr=["R","C","P","K"].includes(p[1])?toCNNum(Math.abs(dy),isRed):toCNNum(dstFile,isRed);
    }
    return fileStr+dirStr+destStr;
  }
}

/** UI */
const engine = new XiangqiEngine();
let selected = null;
let validMoves = [];
const chars = { rK:"帥",rA:"仕",rE:"相",rN:"傌",rR:"俥",rC:"炮",rP:"兵", bK:"將",bA:"士",bE:"象",bN:"馬",bR:"車",bC:"炮",bP:"卒" };

function render() {
  const layer = document.getElementById("gridLayer");
  layer.innerHTML = "";
  for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.style.left = x * 11.11 + "%";
    cell.style.top = y * 10 + "%";
    cell.onclick = () => onCellClick(x, y);
    layer.appendChild(cell);
  }
  if (engine.history.length) {
    const last = engine.history[engine.history.length - 1];
    addMarker(layer, last.fx, last.fy, "marker last");
    addMarker(layer, last.tx, last.ty, "marker last");
  }
  if (selected) addMarker(layer, selected.x, selected.y, "marker selected");
  validMoves.forEach(m => addMarker(layer, m.x, m.y, "marker valid"));
  for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
    const p = engine.getPiece(x, y);
    if (p) {
      const div = document.createElement("div");
      div.className = `piece ${p[0] === "r" ? "red" : "black"}`;
      div.innerText = chars[p];
      div.style.left = x * 11.11 + 5.55 + "%";
      div.style.top = y * 10 + 5 + "%";
      layer.appendChild(div);
    }
  }
}
function addMarker(p, x, y, c) {
  const d = document.createElement("div");
  d.className = c;
  d.style.left = x * 11.11 + 5.55 + "%";
  d.style.top = y * 10 + 5 + "%";
  p.appendChild(d);
}
function onCellClick(x, y) {
  const p = engine.getPiece(x, y);
  const myTurn = p && p[0] === engine.turn;
  if (myTurn) { selected = { x, y }; validMoves = engine.getValidMoves(x, y); render(); return; }
  if (selected) {
    if (validMoves.some(m => m.x === x && m.y === y)) {
      const res = engine.move(selected.x, selected.y, x, y);
      if (res.success) {
        selected = null; validMoves = [];
        render(); updateUI();
        if (res.check) { playSound("check"); splash(); }
        else if (res.capture) playSound("capture");
        else playSound("move");
      }
    } else { selected = null; validMoves = []; render(); }
  }
}
function updateUI() {
  document.getElementById("status").innerText = (engine.turn === "r" ? "Red" : "Black") + "'s Turn";
  document.getElementById("status").style.color = engine.turn === "r" ? "#ff5252" : "#fff";
  const list = document.getElementById("moveHistory");
  list.innerHTML = "";
  for (let i = 0; i < engine.history.length; i += 2) {
    const rm = engine.history[i];
    const bm = engine.history[i + 1];
    const row = document.createElement("div");
    row.className = "move-row";
    row.innerHTML = `<span style="color:#aaa;width:25px;">${i/2+1}.</span><span style="color:#ff5252;flex:1;">${rm?rm.notation:""}</span><span style="color:#eee;flex:1;text-align:right;">${bm?bm.notation:""}</span>`;
    list.appendChild(row);
  }
  list.scrollTop = list.scrollHeight;
}
function splash() {
  const el = document.getElementById("splash");
  el.classList.remove("active");
  void el.offsetWidth;
  el.classList.add("active");
  setTimeout(() => el.classList.remove("active"), 1200);
}
const game = {
  reset: () => { engine.reset(); selected = null; validMoves = []; render(); updateUI(); playSound("move"); },
  undo: () => { if (engine.undo()) { selected = null; validMoves = []; render(); updateUI(); playSound("move"); } },
  exportXQPro: () => {
    let coords = "";
    engine.history.forEach(m => coords += `${m.fx}${m.fy}${m.tx}${m.ty}`);
    const data = { type: "XiangqiMaster_Save", fen: engine.initialFen, moves: coords };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "game.xqpro";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  },
  exportText: () => {
    let txt = "开始局面: " + engine.initialFen + "\n着法: \n";
    for (let i = 0; i < engine.history.length; i += 2) {
      const rm = engine.history[i];
      const bm = engine.history[i + 1];
      txt += `${i/2+1}. ${rm.cnNotation}${bm?` ${bm.cnNotation}`:""}\n`;
    }
    document.getElementById("ioInput").value = txt;
  },
  loadFile: e => { const f=e.target.files[0]; if(f){const r=new FileReader(); r.onload=evt=>game.parse(evt.target.result); r.readAsText(f);}},
  loadFromInput: () => game.parse(document.getElementById("ioInput").value),
  parse: txt => {
    let fen = engine.initialFen, moveStr = "";
    try { const j=JSON.parse(txt); if(j.type==="XiangqiMaster_Save"){fen=j.fen;moveStr=j.moves;} }
    catch(e){
      const f=txt.match(/_fen](.*?)\[/); if(f) fen=f[1];
      const m=txt.match(/_movelist](.*?)\[/); if(m) moveStr=m[1];
      if(!m && /^\d+$/.test(txt.trim())) moveStr=txt.trim();
    }
    engine.reset(); engine.loadFEN(fen); engine.initialFen=fen;
    for(let i=0;i<moveStr.length;i+=4){
      const fx=parseInt(moveStr[i]), fy=parseInt(moveStr[i+1]), tx=parseInt(moveStr[i+2]), ty=parseInt(moveStr[i+3]);
      const p=engine.getPiece(fx,fy);
      if(p){
        engine.board[ty][tx]=p; engine.board[fy][fx]=null;
        engine.history.push({fx,fy,tx,ty,captured:engine.getPiece(tx,ty),p,
          notation:engine.getWXFNotation(fx,fy,tx,ty,p),
          cnNotation:engine.getChineseNotation(fx,fy,tx,ty,p)});
        engine.turn=engine.turn==="r"?"b":"r";
      }
    }
    selected=null; validMoves=[]; render(); updateUI(); playSound("move");
  }
};

render();
updateUI();
