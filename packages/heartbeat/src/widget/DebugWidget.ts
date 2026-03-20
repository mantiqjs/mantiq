/**
 * Floating debug widget — injected into HTML responses when APP_DEBUG=true.
 * Compact pill with mantiq branding, expands to stats panel on click.
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
  const statusColor = status >= 500 ? '#f87171' : status >= 400 ? '#fbbf24' : '#34d399'

  return `<!-- mantiq:heartbeat-widget -->
<style>
#__mw{position:fixed;bottom:16px;right:16px;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:12px}
#__mw_pill{display:flex;align-items:center;gap:6px;background:#0a0a0b;border:1px solid #27272a;border-radius:100px;padding:7px 14px 7px 10px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.5);color:#71717a;transition:border-color .2s;user-select:none}
#__mw_pill:hover{border-color:#34d399}
#__mw_logo{display:flex;align-items:center;border-right:1px solid #27272a;padding-right:8px;margin-right:2px}
#__mw_logo span{width:7px;height:7px;border-radius:50%;background:#34d399}
#__mw_stats{display:flex;align-items:center;gap:6px}
#__mw_stats b{color:#fafafa;font-weight:600}
#__mw_dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
#__mw_sep{color:#27272a}
#__mw_panel{display:none;position:absolute;bottom:calc(100% + 10px);right:0;background:#0a0a0b;border:1px solid #27272a;border-radius:12px;min-width:280px;box-shadow:0 12px 32px rgba(0,0,0,.6);overflow:hidden}
#__mw_panel header{padding:14px 16px;border-bottom:1px solid #1e1e1e;display:flex;align-items:center;justify-content:space-between}
#__mw_panel header .brand{display:flex;align-items:center;gap:6px;color:#fafafa;font-weight:700;font-size:12px;letter-spacing:-.01em}
#__mw_panel header .brand i{width:6px;height:6px;border-radius:50%;background:#34d399}
#__mw_grid{display:grid;grid-template-columns:1fr 1fr;gap:0}
#__mw_grid .cell{padding:14px 16px;border-bottom:1px solid #1e1e1e}
#__mw_grid .cell:nth-child(odd){border-right:1px solid #1e1e1e}
#__mw_grid .cell label{display:block;color:#52525b;font-size:10px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
#__mw_grid .cell .val{color:#fafafa;font-weight:700;font-size:18px;letter-spacing:-.02em}
#__mw_grid .cell .val small{color:#52525b;font-size:11px;font-weight:400;margin-left:1px}
#__mw_cta{padding:12px 16px}
#__mw_cta a{display:flex;align-items:center;justify-content:center;gap:6px;color:#0a0a0b;background:#34d399;padding:8px;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none;transition:background .15s}
#__mw_cta a:hover{background:#10b981}
</style>
<div id="__mw">
  <div id="__mw_pill" onclick="document.getElementById('__mw_panel').style.display=document.getElementById('__mw_panel').style.display==='none'?'block':'none'">
    <div id="__mw_logo"><span></span></div>
    <div id="__mw_stats">
      <span id="__mw_dot" style="background:${statusColor}"></span>
      <b>${durationMs}ms</b>
      <span id="__mw_sep">&middot;</span>
      <span>${memMB}MB</span>
      <span id="__mw_sep">&middot;</span>
      <span>${queries}q</span>
    </div>
  </div>
  <div id="__mw_panel">
    <header>
      <div class="brand"><i></i>mantiq</div>
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

  // Intercept fetch to read X-Heartbeat header and update widget
  var _fetch=window.fetch;
  window.fetch=function(){
    return _fetch.apply(this,arguments).then(function(res){
      var h=res.headers.get('X-Heartbeat');
      if(h)updateWidget(h);
      return res;
    });
  };

  function updateWidget(header){
    // Format: 15ms;1.6MB;200;0q
    var p=header.split(';');
    if(p.length<4)return;
    var dur=p[0],mem=p[1],status=parseInt(p[2]),queries=p[3];
    var sc=status>=500?'#f87171':status>=400?'#fbbf24':'#34d399';

    // Update pill
    var pill=document.getElementById('__mw_stats');
    if(pill)pill.innerHTML='<span id="__mw_dot" style="width:5px;height:5px;border-radius:50%;background:'+sc+';flex-shrink:0"></span><b style="color:#fafafa;font-weight:600">'+dur+'</b><span id="__mw_sep" style="color:#27272a">&middot;</span><span>'+mem+'</span><span id="__mw_sep" style="color:#27272a">&middot;</span><span>'+queries+'</span>';

    // Update panel grid
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
