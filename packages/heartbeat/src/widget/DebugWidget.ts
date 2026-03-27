/**
 * Floating debug widget — injected into HTML responses when APP_DEBUG=true.
 * Monospace neon emerald pill with Apple-like raised panel.
 */

export function renderWidget(data: {
  duration: number
  memory: number
  status: number
  queries: number
  dashboardPath: string
}): string {
  const { duration, memory, status, queries, dashboardPath } = data
  const memMB = (memory / 1024 / 1024).toFixed(1)
  const durationMs = duration.toFixed(0)
  const statusColor = status >= 500 ? '#fb7185' : status >= 400 ? '#fbbf24' : '#34d399'

  return `<!-- mantiq:heartbeat-widget -->
<style>
@keyframes mw-fade{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes mw-glow{0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,0)}50%{box-shadow:0 0 12px 2px rgba(52,211,153,.15)}}
#__mw{position:fixed;bottom:20px;right:20px;z-index:99999;font-family:'SF Mono',ui-monospace,'Cascadia Mono','JetBrains Mono',Menlo,monospace;font-size:11px}
#__mw_pill{
  display:flex;align-items:center;gap:8px;
  background:#0b0f0d;border:1px solid #1a2e25;border-radius:100px;
  padding:8px 16px 8px 12px;cursor:pointer;color:#6ee7b7;
  transition:all .25s cubic-bezier(.4,0,.2,1);user-select:none;
  animation:mw-fade .3s ease-out,mw-glow 3s ease-in-out infinite;
  backdrop-filter:blur(12px);
}
#__mw_pill:hover{border-color:#34d399;background:#0e1412}
#__mw_logo{display:flex;align-items:center;border-right:1px solid #1a2e25;padding-right:10px;margin-right:2px}
#__mw_logo span{width:6px;height:6px;border-radius:50%;background:#34d399;box-shadow:0 0 8px #34d399}
#__mw_stats{display:flex;align-items:center;gap:8px;font-weight:600}
#__mw_stats b{color:#f0fdf4;font-weight:700}
#__mw_dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
#__mw_sep{color:#1a2e25;font-weight:400}
#__mw_panel{
  display:none;position:absolute;bottom:calc(100% + 12px);right:0;
  background:#0b0f0d;border:1px solid #1a2e25;border-radius:16px;
  min-width:300px;overflow:hidden;
  animation:mw-fade .2s ease-out;
  backdrop-filter:blur(16px);
}
#__mw_panel header{
  padding:16px 18px;border-bottom:1px solid #1a2e25;
  display:flex;align-items:center;justify-content:space-between;
}
#__mw_panel header .brand{
  display:flex;align-items:center;gap:8px;color:#f0fdf4;font-weight:700;
  font-size:12px;letter-spacing:-.01em;
}
#__mw_panel header .brand i{width:6px;height:6px;border-radius:50%;background:#34d399;box-shadow:0 0 6px #34d399}
#__mw_grid{display:grid;grid-template-columns:1fr 1fr;gap:0}
#__mw_grid .cell{padding:16px 18px;border-bottom:1px solid #1a2e25;transition:background .15s}
#__mw_grid .cell:hover{background:rgba(52,211,153,.05)}
#__mw_grid .cell:nth-child(odd){border-right:1px solid #1a2e25}
#__mw_grid .cell label{display:block;color:#3b5249;font-size:9px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;font-weight:700}
#__mw_grid .cell .val{color:#f0fdf4;font-weight:800;font-size:22px;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
#__mw_grid .cell .val small{color:#3b5249;font-size:10px;font-weight:500;margin-left:2px}
#__mw_cta{padding:14px 18px}
#__mw_cta a{
  display:flex;align-items:center;justify-content:center;gap:6px;
  color:#0b0f0d;background:#34d399;padding:10px;border-radius:12px;
  font-size:11px;font-weight:700;text-decoration:none;letter-spacing:.01em;
  transition:all .2s;border:1px solid transparent;
}
#__mw_cta a:hover{background:#6ee7b7;box-shadow:0 0 16px rgba(52,211,153,.3)}
</style>
<div id="__mw">
  <div id="__mw_pill" onclick="document.getElementById('__mw_panel').style.display=document.getElementById('__mw_panel').style.display==='none'?'block':'none'">
    <div id="__mw_logo"><span></span></div>
    <div id="__mw_stats">
      <span id="__mw_dot" style="background:${statusColor};box-shadow:0 0 6px ${statusColor}"></span>
      <b>${durationMs}ms</b>
      <span id="__mw_sep">&middot;</span>
      <span>${memMB}MB</span>
      <span id="__mw_sep">&middot;</span>
      <span>${queries}q</span>
    </div>
  </div>
  <div id="__mw_panel">
    <header>
      <div class="brand"><i></i>heartbeat</div>
    </header>
    <div id="__mw_grid">
      <div class="cell"><label>Duration</label><div class="val">${durationMs}<small>ms</small></div></div>
      <div class="cell"><label>Memory</label><div class="val">${memMB}<small>MB</small></div></div>
      <div class="cell"><label>Status</label><div class="val" style="color:${statusColor}">${status}</div></div>
      <div class="cell"><label>Queries</label><div class="val">${queries}</div></div>
    </div>
    <div id="__mw_cta">
      <a href="${dashboardPath}">Open Heartbeat &rarr;</a>
    </div>
  </div>
</div>
<script>
(function(){
  document.addEventListener('keydown',function(e){if(e.key==='Escape')document.getElementById('__mw_panel').style.display='none'});

  var _fetch=window.fetch;
  window.fetch=function(){
    return _fetch.apply(this,arguments).then(function(res){
      var h=res.headers.get('X-Heartbeat');
      if(h)updateWidget(h);
      return res;
    });
  };

  function updateWidget(header){
    var p=header.split(';');
    if(p.length<4)return;
    var dur=p[0],mem=p[1],status=parseInt(p[2]),queries=p[3];
    var sc=status>=500?'#fb7185':status>=400?'#fbbf24':'#34d399';

    var pill=document.getElementById('__mw_stats');
    if(pill)pill.innerHTML='<span id="__mw_dot" style="width:5px;height:5px;border-radius:50%;background:'+sc+';box-shadow:0 0 6px '+sc+';flex-shrink:0"></span><b style="color:#f0fdf4;font-weight:700">'+dur+'</b><span id="__mw_sep" style="color:#1a2e25">&middot;</span><span>'+mem+'</span><span id="__mw_sep" style="color:#1a2e25">&middot;</span><span>'+queries+'</span>';

    var cells=document.querySelectorAll('#__mw_grid .cell .val');
    if(cells.length>=4){
      cells[0].innerHTML=dur.replace('ms','')+'<small>ms</small>';
      cells[1].innerHTML=mem.replace('MB','')+'<small>MB</small>';
      cells[2].innerHTML=status;cells[2].style.color=sc;
      cells[3].innerHTML=queries.replace('q','');
    }
  }
})();
</script>
<!-- /mantiq:heartbeat-widget -->`
}
