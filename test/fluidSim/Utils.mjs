import assert from "assert";
import Utils from "../../fluidSim/Utils.mjs";

describe('fluidSim', Tests);
function Tests()
{
  describe('Utils', Utils_Tests);
}

function Utils_Tests()
{
  it('Interpolate()', Interpolate_Tests);
  it('Interpolate_Colour()', Interpolate_Colour_Tests);
  it('Wrap_To_Range()', Wrap_To_Range_Tests);
}

function Interpolate_Tests()
{
  let pts =
  [
    {x: 0, y: 0},
    {x: 1, y: 1}
  ];
  let actual = Utils.Interpolate(0, pts);
  assert.equal(actual, 0, "t1");
  actual = Utils.Interpolate(0.5, pts);
  assert.equal(actual, 0.5, "t2");
  actual = Utils.Interpolate(1, pts);
  assert.equal(actual, 1, "t3");

  pts =
  [
    {x: 0, y: 1},
    {x: 1, y: 2}
  ];
  actual = Utils.Interpolate(0, pts);
  assert.equal(actual, 1, "t4");
  actual = Utils.Interpolate(0.5, pts);
  assert.equal(actual, 1.5, "t5");
  actual = Utils.Interpolate(1, pts);
  assert.equal(actual, 2, "t6");

  pts =
  [
    {x: 0, y: 1},
    {x: 1, y: 2},
    {x: 2, y: 0}
  ];
  actual = Utils.Interpolate(0, pts);
  assert.equal(actual, 1, "t7");
  actual = Utils.Interpolate(0.5, pts);
  assert.equal(actual, 1.5, "t8");
  actual = Utils.Interpolate(1, pts);
  assert.equal(actual, 2, "t9");
  actual = Utils.Interpolate(1.5, pts);
  assert.equal(actual, 1, "t10");
  actual = Utils.Interpolate(2, pts);
  assert.equal(actual, 0, "t11");
}

function Interpolate_Colour_Tests()
{
  let colours =
  [
    {x: 0, colour: {r: 0, g: 0, b:0}},
    {x: 1, colour: {r: 255, g: 255, b:255}},
  ];
  let actual = Utils.Interpolate_Colour(0, colours);
  assert.deepEqual(actual, {r: 0, g: 0, b: 0});
  actual = Utils.Interpolate_Colour(0.5, colours);
  assert.deepEqual(actual, {r: 128, g: 128, b: 128});
  actual = Utils.Interpolate_Colour(1, colours);
  assert.deepEqual(actual, {r: 255, g: 255, b: 255});

  colours =
  [
    {x: 0, colour: {r: 0, g: 0, b: 255}},
    {x: 1, colour: {r: 255, g: 0, b:0}},
    {x: 2, colour: {r: 0, g: 255, b:0}},
  ];
  actual = Utils.Interpolate_Colour(0, colours);
  assert.deepEqual(actual, {r: 0, g: 0, b: 255});
  actual = Utils.Interpolate_Colour(0.5, colours);
  assert.deepEqual(actual, {r: 128, g: 0, b: 128});
  actual = Utils.Interpolate_Colour(1, colours);
  assert.deepEqual(actual, {r: 255, g: 0, b: 0});
  actual = Utils.Interpolate_Colour(1.5, colours);
  assert.deepEqual(actual, {r: 128, g: 128, b: 0});
  actual = Utils.Interpolate_Colour(2, colours);
  assert.deepEqual(actual, {r: 0, g: 255, b: 0});
}

function Wrap_To_Range_Tests()
{
  const max = 10, min = 20;

  let actual = Utils.Wrap_To_Range(10, max, min);
  assert.equal(actual, 10, "t12");

  actual = Utils.Wrap_To_Range(15, max, min);
  assert.equal(actual, 15, "t13");

  actual = Utils.Wrap_To_Range(20, max, min);
  assert.equal(actual, 10, "t14");

  actual = Utils.Wrap_To_Range(25, max, min);
  assert.equal(actual, 15, "t15");

  actual = Utils.Wrap_To_Range(5, max, min);
  assert.equal(actual, 15, "t16");

  actual = Utils.Wrap_To_Range(0, max, min);
  assert.equal(actual, 10, "t17");
}