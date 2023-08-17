// Based on http://www.dgp.toronto.edu/people/stam/reality/Research/pdf/GDC03.pdf
/**
 * Copyright (c) 2023 Steven Ramirez <http://ramirezsystems.blogspot.com/>
 * 
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */

import Utils from "./Utils.mjs";

class Fluid_Canvas extends HTMLElement
{
  static tname = "fluid-canvas";

  canvas;
  field = null;
  fieldRes;
  running = false;
  interval = null;
  buffer;
  bufferData;
  mouseIsDown = false;
  start = new Date;
  clampData = false;
  score = 0;
  objs_canvas;
  objs;
  max_clock = 60;

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
      <canvas id="clock_canvas" width="200" height="200"></canvas>
      <span id="score_elem"></span>
      <img id="home_img" src="image/home.png" hidden>
      <img id="cat_img" src="image/cats.png" hidden>  
      <div id="intro_dlg" class="msg">
        Use touch or the mouse to guide these floating nauti-cats to their island home, in the middle
        of the lake, before time runs out! Press "New Game" to begin.
      </div>
      <div id="finish_dlg" class="msg">
        You're out of time. You saved <span id="cat_count">0</span> nauti-cats!
      </div>
    `;

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

  Scale_Pos(src_pos, src_size, dest_size, as_int)
  {
    const wr = dest_size.x / src_size.x;
    const hr = dest_size.y / src_size.y;
    const res =
    {
      x: src_pos.x * wr,
      y: src_pos.y * hr
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
    const min = 60;
    const colours =
    [
      {x: 0,   colour: {r: 173, g: 205, b: 212}},
      {x: 50,  colour: {r: 10, g: 56, b: 89}}, // dark blue
      {x: 100, colour: {r: 236, g: 235, b: 238}}, // almost white
      {x: 150, colour: {r: 134, g: 155, b: 183}}, // light blue
      {x: 200, colour: {r: 124, g: 132, b: 108}}, // grey
      {x: 250, colour: {r: 135, g: 185, b: 76}}, // green
      {x: 300, colour: {r: 173, g: 205, b: 212}},
    ];
    const v = Utils.Wrap_To_Range(value, 0, 300);
    const res = Utils.Interpolate_Colour(v, colours);

    return res;
  }

  Start()
  {
    this.running = true;
    this.interval = setTimeout(this.Callback_Update_Frame, 10);
    this.intro_dlg.style.display = "none";
    this.finish_dlg.style.display = "none";
    this.start_btn.innerText = "Pause";
    this.interval_clock = setTimeout(this.Callback_Process_Clock, 1000);
  }

  Pause()
  {
    this.running = false;
    clearTimeout(this.interval);
    clearTimeout(this.interval_clock);
    this.start_btn.innerText = "Start";
  }

  Reset()
  {
    this.Init_Objs();
    this.field.reset(); 
    this.clock = this.max_clock;
    this.Start();
    this.start_btn.hidden = false;
  }

  Finish()
  {
    this.running = false;
    clearTimeout(this.interval);
    clearTimeout(this.interval_clock);
    this.start_btn.hidden = true;
    this.finish_dlg.style.display = "flex";
    this.cat_count.innerText = this.score;
  }

  Get_Event_Pos(event)
  {
    return {x: event.offsetX, y: event.offsetY};
  }

  // Obj Processing ===============================================================================

  Init_Objs()
  {
    this.objs = new Array(100);

    this.objs_canvas_sw = this.objs_canvas.width;
    this.objs_canvas_sh = this.objs_canvas.height;

    this.objs_ctx.fillStyle = "#f00";

    for (let i = 0; i < this.objs.length; i++)
    {
      const obj = 
      {
        id: i,
        class_name: "cat",
        x: Math.random() * this.objs_canvas_sw,
        y: Math.random() * this.objs_canvas_sh,
        r: 8,
        img: this.cat_img,
        Render: this.Render_Obj,
        Update: this.Update_Obj
      };
      this.objs[i] = obj;
    }

    /*const limit = 1000;
    const obj1 = 
    {
      id: 1,
      class_name: "cat",
      x: 0, y: 0,
      r: 8,
      img: this.cat_img,
      Render: this.Render_Obj,
      Update: this.Update_Obj
    };
    this.objs.push(obj1);
    const obj2 = 
    {
      id: 2,
      class_name: "cat",
      x: limit, y: 0,
      r: 8,
      img: this.cat_img,
      Render: this.Render_Obj,
      Update: this.Update_Obj
    };
    this.objs.push(obj2);
    const obj3 = 
    {
      id: 3,
      class_name: "cat",
      x: limit, y: limit,
      r: 8,
      img: this.cat_img,
      Render: this.Render_Obj,
      Update: this.Update_Obj
    };
    this.objs.push(obj3);
    const obj4 = 
    {
      id: 4,
      class_name: "cat",
      x: 0, y: limit,
      r: 8,
      img: this.cat_img,
      Render: this.Render_Obj,
      Update: this.Update_Obj
    };
    this.objs.push(obj4);*/

    const home_obj = 
    {
      id: this.objs.length,
      class_name: "home",
      x: this.objs_canvas_sw / 2,
      y: this.objs_canvas_sh / 2,
      r: 75,
      img: this.home_img,
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
    const src_size = {x: field.canvas.objs_canvas_sw, y: field.canvas.objs_canvas_sh};
    const dest_size = {x: field.width(), y: field.height()};
    const field_pos = field.canvas.Scale_Pos(this, src_size, dest_size, true);

    this.vx = field.getXVelocity(field_pos.x, field_pos.y)*100;
    this.vy = field.getYVelocity(field_pos.x, field_pos.y)*100;

    this.x += this.vx;
    this.y += this.vy;

    this.x = Fluid_Canvas.Limit_To_Range(this.x, 0, field.canvas.objs_canvas_sw);
    this.y = Fluid_Canvas.Limit_To_Range(this.y, 0, field.canvas.objs_canvas_sh);
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
        const idx = objs.indexOf(cat);
        objs[idx] = null;
        field.canvas.score++;
        field.canvas.Render_Score();
      }
    }
  }

  Render_Score()
  {
    this.score_elem.innerText = this.score;
    this.score_elem.classList.add("anim-zoom");
  }

  Render_Obj(ctx)
  {
    //ctx.beginPath(); 
    //ctx.arc (this.x, this.y, this.r, 0, 2 * Math.PI, false); 
    //ctx.fill(); 

    const dir = Utils.Calc_Direction(this.vx, -this.vy);
    const frame_dy = dir * 32 + 1;
    //ctx.drawImage(this.img, 0, frame_dy, 32, 32, this.x - 16, this.y - 22, 32, 32);
    ctx.drawImage(this.img, 0, frame_dy, 32, 32, this.x - 16, this.y - 22, 64, 64);
  }

  Render_Obj_Home(ctx)
  {
    //ctx.beginPath(); 
    //ctx.arc (this.x, this.y, this.r, 0, 2 * Math.PI, false); 
    //ctx.fill(); 

    ctx.drawImage(this.img, this.x - 70, this.y - 94);
  }

  Render_Clock(ctx)
  {
    const r = ctx.canvas.width / 2;
    const r2 = r - 20;
    const i = 2*Math.PI / this.max_clock;
    const start_angle = Math.PI * 1.5;
    const end_angle = start_angle - i * this.clock;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); 

    ctx.fillStyle = "#f00";
    ctx.beginPath();
    ctx.moveTo(r, r);
    ctx.arc(r, r, r, start_angle, end_angle, true);
    ctx.fill();

    ctx.fillStyle = "#f88";
    ctx.beginPath();
    ctx.moveTo(r, r);
    ctx.arc(r, r, r2, start_angle, end_angle, true);
    ctx.fill();
  }

  // Callbacks & Events ===========================================================================

  Callback_Process_Clock()
  {
    this.Render_Clock(this.clock_ctx);
    if (this.clock <= 0)
    {
      this.Finish();
    }
    else
    {
      this.clock--;
      this.interval_clock = setTimeout(this.Callback_Process_Clock, 1000);
    }
  }

  Callback_Render_Density(field)
  {
    this.prepareBuffer(field);
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
      this.canvas_ctx.putImageData(this.bufferData, 0, 0);
    } 
    else
    {
      for (var x = 0; x < width; x++)
      {
        for (var y = 0; y < height; y++)
        {
          var d = field.getDensity(x, y) / 5;
          this.canvas_ctx.setFillColor(0, d, 0, 1);
          this.canvas_ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    this.Process_Objs(field);
  }

  Callback_UI(field)
  {
    if (this.mouseIsDown)
    {
      var dx = this.m_pos.x - this.o_pos.x;
      var dy = this.m_pos.y - this.o_pos.y;
      var length = (Math.sqrt(dx * dx + dy * dy) + 0.5) | 0;
      if (length < 1) length = 1;

      for (var i = 0; i < length; i++)
      {
        const src_pos =
        {
          x: i / length * dx + this.o_pos.x,
          y: i / length * dy + this.o_pos.y
        };
        const rect = this.canvas.getBoundingClientRect();
        const src_size = {x: rect.width, y: rect.height};
        const dst_size = {x: field.width(), y: field.height()};
        const dst_pos = this.Scale_Pos(src_pos, src_size, dst_size, true);

        field.setVelocity(dst_pos.x, dst_pos.y, dx, dy);
        field.setDensity(dst_pos.x, dst_pos.y, 50);
      }

      this.o_pos = this.m_pos;
    }
  }

  Callback_Update_Frame()
  {
    this.field.update();
    if (this.running)
      this.interval = setTimeout(this.Callback_Update_Frame, 10);
  }

  On_Load()
  {
    Utils.Set_Id_Shortcuts(this, this);

    this.finish_dlg.style.display = "none";

    this.objs_ctx = this.objs_canvas.getContext("2d");
    this.canvas_ctx = this.canvas.getContext("2d");
    this.clock_ctx = this.clock_canvas.getContext("2d");

    this.field = new FluidField();
    this.field.setUICallback(this.Callback_UI);

    this.canvas.width = this.fieldRes;
    this.canvas.height = this.fieldRes;
    this.field.setDisplayFunction(this.Callback_Render_Density);

    const r = this.Get_Attribute_Int("resolution", 128);
    this.Set_Resolution(r);

    this.start_btn = document.getElementById("start_btn");
    this.reset_btn = document.getElementById("reset_btn");

    this.score_elem.addEventListener("animationend", this.On_Transition_Ends);
    this.start_btn.addEventListener("click", this.On_Click_Toggle);
    this.reset_btn.addEventListener("click", this.On_Click_Reset);
    this.canvas.addEventListener("pointerdown", this.On_Mouse_Down);
    this.canvas.addEventListener("pointermove", this.On_Mouse_Move);
    window.addEventListener("pointerup", this.On_Mouse_Up);
  }

  On_Transition_Ends()
  {
    this.score_elem.classList.remove("anim-zoom");
  }

  On_Mouse_Move(event)
  {
    this.m_pos = this.Get_Event_Pos(event);
  }

  On_Mouse_Down(event)
  {
    event.preventDefault();
    this.mouseIsDown = true;
    this.m_pos = this.Get_Event_Pos(event);
    this.o_pos = this.m_pos;

    return false;
  }

  On_Mouse_Up() 
  { 
    this.mouseIsDown = false; 
  }

  On_Click_Toggle()
  {
    if (this.running)
    {
      this.Pause();
    }
    else
    {
      this.Start();
    }
  }

  On_Click_Reset()
  {
    this.Reset();
  }
}

Utils.Register_Element(Fluid_Canvas);