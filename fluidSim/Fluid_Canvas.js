import Utils from "./Utils.js";

class Fluid_Canvas extends HTMLElement
{
  static tname = "fluid-canvas";

  canvas;
  field = null;
  fieldRes;
  showVectors = false;
  running = false;
  interval = null;
  sources = [];
  buffer;
  bufferData;
  frames = 0;
  force = 5;
  source = 100;
  omx;
  omy;
  mx;
  my;
  mouseIsDown = false;
  displaySize = 512;
  start = new Date;
  frames = 0;
  clampData = false;

  objs_canvas;
  objs;

  // Lifecycle ====================================================================================

  constructor()
  {
    super();
    Utils.Bind(this, "On_");
    Utils.Bind(this, "Callback_");
  }

  connectedCallback()
  {
    this.innerHTML = `
      <canvas id="canvas"></canvas>
      <canvas id="objs_canvas" width="1000" height="1000"></canvas>
    `;

    this.Init_Objs();
    this.On_Load();
  }

  // Misc =========================================================================================

  getTopLeftOfElement(element)
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
    
  toggleDisplayFunction(canvas)
  {
    if (this.showVectors)
    {
      this.showVectors = false;
      canvas.width = this.displaySize;
      canvas.height = this.displaySize;
      return this.Callback_displayVelocity;
    }
    else
    {
      this.showVectors = true;
      canvas.width = this.fieldRes;
      canvas.height = this.fieldRes;
      return this.Callback_Render_Density;
    }
  }

  prepareBuffer(field)
  {
    if (this.buffer && this.buffer.width == field.width() && this.buffer.height == field.height())
      return;
    this.buffer = document.createElement("canvas");
    this.buffer.width = field.width();
    this.buffer.height = field.height();
    var context = this.buffer.getContext("2d");
    try
    {
      this.bufferData = context.createImageData(field.width(), field.height());
    } catch (e)
    {
      return null;
    }
    if (!this.bufferData)
      return null;
    var max = field.width() * field.height() * 4;
    for (var i = 3; i < max; i += 4)
      this.bufferData.data[i] = 255;
    this.bufferData.data[0] = 256;
    if (this.bufferData.data[0] > 255)
      this.clampData = true;
    this.bufferData.data[0] = 0;
  }

  To_Field_Pos(client_pos)
  {
    const dest_size = {x: this.displaySize, y: this.displaySize};
    return this.Scale_Pos(client_pos, dest_size, false);
  }

  Scale_Pos(client_pos, dest_size, as_int)
  {
    var o = this.getTopLeftOfElement(this.canvas);

    const cdw_str = getComputedStyle(this.canvas).width;
    const cdh_str = getComputedStyle(this.canvas).height;
    const cdw = this.To_Float(cdw_str);
    const cdh = this.To_Float(cdh_str);
    const wr = dest_size.x / cdw;
    const hr = dest_size.y / cdh;
    const res =
    {
      x: (client_pos.x - o.left) * wr,
      y: (client_pos.y - o.top) * hr
    };

    if (as_int)
    {
      res.x = Math.trunc(res.x);
      res.y = Math.trunc(res.y);
    }

    return res;
  }

  To_Float(px_str)
  {
    return Number.parseFloat(px_str.substring(0, px_str.length-2));
  }

  static Limit_To_Range(value, min, max)
  {
    let res = value;

    if (res < min)
    {
      res = min;
    }
    else if (res > max)
    {
      res = max;
    }

    return res;
  }

  Set_Resolution(r)
  {
    this.canvas.width = r;
    this.canvas.height = r;
    this.fieldRes = r;
    this.field.setResolution(r, r);
  }

  Get_Attribute_Int(name, def_value)
  {
    let res = def_value;
    if (this.hasAttribute(name))
    {
      res = this.getAttribute(name);
      res = parseInt(res);
    }

    return res;
  }

  static To_Colour(value)
  {
    const res =
    {
      r: Fluid_Canvas.Limit_To_Range(value, 0, 255),
      g: 0,
      b: 0
    };

    return res;
  }

  // Obj Processing ===============================================================================

  Init_Objs()
  {
    this.objs = new Array(100);

    this.objs_canvas = this.querySelector("#objs_canvas");
    this.objs_canvas_sw = this.To_Float(getComputedStyle(this.objs_canvas).width);
    this.objs_canvas_sh = this.To_Float(getComputedStyle(this.objs_canvas).height);

    this.objs_ctx = this.objs_canvas.getContext("2d");
    this.objs_ctx.fillStyle = "#f00";

    for (let i = 0; i < this.objs.length; i++)
    {
      const obj = 
      {
        id: i,
        class_name: "cat",
        x: Math.random() * this.objs_canvas_sw,
        y: Math.random() * this.objs_canvas_sh,
        r: 5,
        Render: this.Render_Obj,
        Update: this.Update_Obj
      };
      this.objs[i] = obj;
    }

    const home_obj = 
    {
      id: this.objs.length,
      class_name: "home",
      x: this.objs_canvas_sw / 2,
      y: this.objs_canvas_sh / 2,
      r: 40,
      Render: this.Render_Obj_Home,
      Update: this.Update_Obj_Home
    };
    this.objs.push(home_obj);
  }

  Process_Objs(field)
  {
    field.canvas = this;
    for (let i = 0; i < this.objs.length; i++)
    {
      const obj = this.objs[i];
      if (obj?.Update)
      {
        obj.Update(field);
      }
    }

    this.objs_ctx.clearRect(0, 0, this.objs_canvas.width, this.objs_canvas.height); 
    for (let i = 0; i < this.objs.length; i++)
    {
      const obj = this.objs[i];
      if (obj?.Render)
      {
        obj.Render(this.objs_ctx);
      }
    }
  }

  Update_Obj(field)
  {
    const field_pos = field.canvas.Scale_Pos(this, {x: field.width(), y: field.height()}, true);
    const dx = field.getXVelocity(field_pos.x, field_pos.y)*100;
    const dy = field.getYVelocity(field_pos.x, field_pos.y)*100;
    this.x += dx;
    this.y += dy;

    this.x = Fluid_Canvas.Limit_To_Range(this.x, 0, this.objs_canvas_sw-80);
    this.y = Fluid_Canvas.Limit_To_Range(this.y, 0, this.objs_canvas_sh-80);
  }
  
  Update_Obj_Home(field)
  {
    const objs = field.canvas.objs;
    const cats = objs.filter(o => o?.class_name == "cat");
    const home = objs.find(o => o?.class_name == "home");

    for (const cat of cats)
    {
      const is_home = Utils.Is_Circle_Circle_Collision(home.x, home.y, home.r, cat.x, cat.y, cat.r);
      if (is_home)
      {
        objs[cat.id] = null;
      }
    }
  }

  Render_Obj(ctx)
  {
    ctx.beginPath(); 
    ctx.arc (this.x, this.y, this.r, 0, 2 * Math.PI, false); 
    ctx.fill(); 
  }

  Render_Obj_Home(ctx)
  {
    ctx.beginPath(); 
    ctx.arc (this.x, this.y, this.r, 0, 2 * Math.PI, false); 
    ctx.fill(); 
  }

  // Callbacks & Events ===========================================================================

  Callback_Render_Density(field)
  {
    this.prepareBuffer(field);
    var context = this.canvas.getContext("2d");
    var width = field.width();
    var height = field.height();

    if (this.bufferData)
    {
      var data = this.bufferData.data;
      for (var x = 0; x < width; x++)
      {
        for (var y = 0; y < height; y++)
        {
          let d = field.getDensity(x, y) * 255 / 5;
          const colour = Fluid_Canvas.To_Colour(d);

          const pixel_idx = 4 * (y * height + x);
          data[pixel_idx] = colour.r;
          data[pixel_idx + 1] = colour.g;
          data[pixel_idx + 2] = colour.b;
        }
      }
      context.putImageData(this.bufferData, 0, 0);
    } 
    else
    {
      for (var x = 0; x < width; x++)
      {
        for (var y = 0; y < height; y++)
        {
          var d = field.getDensity(x, y) / 5;
          context.setFillColor(0, d, 0, 1);
          context.fillRect(x, y, 1, 1);
        }
      }
    }

    this.Process_Objs(field);
  }

  Callback_displayVelocity(field)
  {
    var context = this.canvas.getContext("2d");
    context.save();
    context.lineWidth = 1;
    var wScale = this.canvas.width / field.width();
    var hScale = this.canvas.height / field.height();
    context.fillStyle = "black";
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    context.strokeStyle = "rgb(0,255,0)";
    var vectorScale = 10;
    context.beginPath();
    for (var x = 0; x < field.width(); x++)
    {
      for (var y = 0; y < field.height(); y++)
      {
        context.moveTo(x * wScale + 0.5 * wScale, y * hScale + 0.5 * hScale);
        context.lineTo((x + 0.5 + vectorScale * field.getXVelocity(x, y)) * wScale,
          (y + 0.5 + vectorScale * field.getYVelocity(x, y)) * hScale);
      }
    }
    context.stroke();
    context.restore();
  }

  Callback_UI(field)
  {
    if ((this.omx >= 0 && this.omx < this.displaySize && this.omy >= 0 && this.omy < this.displaySize) && this.mouseIsDown)
    {
      var dx = this.mx - this.omx;
      var dy = this.my - this.omy;
      var length = (Math.sqrt(dx * dx + dy * dy) + 0.5) | 0;
      if (length < 1) length = 1;

      for (var i = 0; i < length; i++)
      {
        var x = (((this.omx + dx * (i / length)) / this.displaySize) * field.width()) | 0
        var y = (((this.omy + dy * (i / length)) / this.displaySize) * field.height()) | 0;

        field.setVelocity(x, y, dx, dy);
        field.setDensity(x, y, 50);
      }

      this.omx = this.mx;
      this.omy = this.my;
    }
    for (var i = 0; i < this.sources.length; i++)
    {
      var x = ((this.sources[i][0] / this.displaySize) * field.width()) | 0;
      var y = ((this.sources[i][1] / this.displaySize) * field.height()) | 0;
      field.setDensity(x, y, 30);
    }
  }

  Callback_Update_Frame_Rate()
  {
    this.field.update();
    var end = new Date;
    frames++;
    if ((end - this.start) > 1000)
    {
      const message = "FPS: " + ((1000 * frames / (end - this.start) + 0.5) | 0);
      document.getElementById("log").innerHTML = message;
      this.start = end;
      frames = 0;
    }
    if (this.running)
      this.interval = setTimeout(this.Callback_Update_Frame_Rate, 10);
  }

  On_Load()
  {
    this.canvas = document.getElementById("canvas");
    this.canvas.onmousedown = this.On_Mouse_Down;
    this.canvas.onmousemove = this.On_Mouse_Move;

    document.getElementById("iterations").value = 10;

    this.field = new FluidField();
    this.field.setUICallback(this.Callback_UI);
    this.field.setDisplayFunction(this.toggleDisplayFunction(this.canvas));

    const r = this.Get_Attribute_Int("resolution", 128);
    this.Set_Resolution(r);

    document.getElementById("start_btn").onclick = this.On_Click_Start;
    document.getElementById("stop_btn").onclick = this.On_Click_Stop;
    document.getElementById("reset_btn").onclick = this.On_Click_Reset;
    document.getElementById("toggle_btn").onclick = this.On_Click_Toggle;
    document.getElementById("iterations").onchange = this.On_Change_Iterations;
    window.onmouseup = this.On_Mouse_Up;

    this.On_Click_Start();
  }

  On_Click_Stop()
  {
    this.running = false;
    clearTimeout(this.interval);
  }

  On_Click_Start()
  {
    if (this.running)
      return;
    this.running = true;
    this.interval = setTimeout(this.Callback_Update_Frame_Rate, 10);
  }

  On_Mouse_Move(event)
  {
    const field_pos = this.To_Field_Pos({x: event.clientX, y: event.clientY});
    this.mx = field_pos.x;
    this.my = field_pos.y;
  }

  On_Mouse_Down(event)
  {
    const field_pos = this.To_Field_Pos({x: event.clientX, y: event.clientY});
    this.omx = this.mx = field_pos.x;
    this.omy = this.my = field_pos.y;
    if (!event.altKey && event.button == 0)
      this.mouseIsDown = true;
    else
      this.sources.push([this.mx, this.my]);
    event.preventDefault();
    return false;
  }

  On_Mouse_Up() 
  { 
    this.mouseIsDown = false; 
  }

  On_Click_Reset()
  {
    this.field.reset(); 
    frames = 0; 
    this.sources = [];
  }

  On_Click_Toggle()
  {
    this.field.setDisplayFunction(this.toggleDisplayFunction(this.canvas));
  }

  On_Change_Iterations(event)
  {
    this.field.setIterations(event.target.value);
  }
}

Utils.Register_Element(Fluid_Canvas);