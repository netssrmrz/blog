var frames = 0;
var force = 5;
var source = 100;
var sources = [];
var omx, omy;
var mx, my;
var mouseIsDown = false;
var res;
var displaySize = 512;
var fieldRes;
var canvas;
var running = false;
var start = new Date;
var frames = 0;
let field = null;

function prepareFrame(field)
{
  var canvas = document.getElementById("canvas");
  if ((omx >= 0 && omx < displaySize && omy >= 0 && omy < displaySize) && mouseIsDown)
  {
    var dx = mx - omx;
    var dy = my - omy;
    var length = (Math.sqrt(dx * dx + dy * dy) + 0.5) | 0;
    if (length < 1) length = 1;
    for (var i = 0; i < length; i++)
    {
      var x = (((omx + dx * (i / length)) / displaySize) * field.width()) | 0
      var y = (((omy + dy * (i / length)) / displaySize) * field.height()) | 0;
      field.setVelocity(x, y, dx, dy);
      field.setDensity(x, y, 50);
    }
    omx = mx;
    omy = my;
  }
  for (var i = 0; i < sources.length; i++)
  {
    var x = ((sources[i][0] / displaySize) * field.width()) | 0;
    var y = ((sources[i][1] / displaySize) * field.height()) | 0;
    field.setDensity(x, y, 30);
  }
}

function updateFrame()
{
  field.update();
  var end = new Date;
  frames++;
  if ((end - start) > 1000)
  {
    const message = "FPS: " + ((1000 * frames / (end - start) + 0.5) | 0);
    document.getElementById("log").innerHTML = message;
    start = end;
    frames = 0;
  }
  if (running)
    interval = setTimeout(updateFrame, 10);
}

function getTopLeftOfElement(element)
{
  var top = 0;
  var left = 0;
  do
  {
    top += element.offsetTop;
    left += element.offsetLeft;
  } 
  while (element = element.offsetParent);
  return { left: left, top: top };
}

window.onload = On_Load;
function On_Load()
{
  canvas = document.getElementById("canvas");
  field = new FluidField();
  document.getElementById("iterations").value = 10;
  res = document.getElementById("resolution");
  field.setUICallback(prepareFrame);
  On_Change_Resolution();

  document.getElementById("start_btn").onclick = On_Click_Start;
  document.getElementById("stop_btn").onclick = On_Click_Stop;
  document.getElementById("reset_btn").onclick = On_Click_Reset;
  document.getElementById("toggle_btn").onclick = On_Click_Toggle;
  document.getElementById("iterations").onchange = On_Change_Iterations;
  document.getElementById("resolution").onchange = On_Change_Resolution;
  window.onmouseup = On_Mouse_Up;
  canvas.onmousedown = On_Mouse_Down;
  canvas.onmousemove = On_Mouse_Move;

  field.setDisplayFunction(toggleDisplayFunction(canvas));
  On_Click_Start();
}

function On_Click_Stop()
{
  running = false;
  clearTimeout(interval);
}

function On_Click_Start()
{
  if (running)
    return;
  running = true;
  interval = setTimeout(updateFrame, 10);
}

function On_Mouse_Move(event)
{
  var o = getTopLeftOfElement(canvas);
  mx = event.clientX - o.left;
  my = event.clientY - o.top;
}

function On_Mouse_Down(event)
{
  var o = getTopLeftOfElement(canvas);
  omx = mx = event.clientX - o.left;
  omy = my = event.clientY - o.top;
  if (!event.altKey && event.button == 0)
    mouseIsDown = true;
  else
    sources.push([mx, my]);
  event.preventDefault();
  return false;
}

function On_Change_Resolution()
{
  var r = parseInt(res.value);
  canvas.width = r;
  canvas.height = r;
  fieldRes = r;
  field.setResolution(r, r);
}

function On_Mouse_Up() 
{ 
  mouseIsDown = false; 
}

function On_Click_Reset()
{
  field.reset(); 
  frames = 0; 
  sources = [];
}

function On_Click_Toggle()
{
  field.setDisplayFunction(toggleDisplayFunction(canvas));
}

function On_Change_Iterations(event)
{
  field.setIterations(event.target.value);
}