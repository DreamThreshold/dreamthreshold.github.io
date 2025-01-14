
/*
*/

//------------------------------------------------------------------------------
//
//      "3D" SVG stuff
//
// Main feature here is the View class.
// Has some features that aren't used much, like sprites/states.
// has additional functions for bitplanes.


// Shorthand
let cos = Math.cos, sin = Math.sin, round = Math.round;


//
class State {

  constructor(details,kind) {


    Object.assign(this, details);

    if (kind == null){
      kind = 'pixels';
    }
    this.kind = kind;
    //HACK: must be a better way of doing this, with .assign?
    switch (kind){
      case 'pixels':
        this.pixels = details; // y, x, channel; 3D array of pixel values
        this.xStartCentered = -sqs*this.pixels[0].length/2;
        this.yStartCentered = -sqs*this.pixels.length/2;
        this.width = sqs*this.pixels[0].length;
        this.height = sqs*this.pixels.length;
        break;
      case 'path':
        this.pathPoints = details.pathPoints;
        this.fill = details.fill;
        this.stroke = details.stroke;
        break;
      case 'pathCurve':
        this.pathPoints = details.pathPoints;
        this.pathPointsExtra = details.pathPointsExtra;
        this.fixedPoints = details.fixedPoints;
        this.fill = details.fill;
        this.stroke = details.stroke;
        break;

    }


  }
}

class Sprite {
  constructor(states, x, y, width, height, untethered, animation) {
    if (untethered==null){
      this.untethered = false;
    } else {
      this.untethered = untethered;
    }
    if (animation==null){
      this.animation = false;
    } else {
      this.animation = animation;
    }
  	this.states = states;
    this.kind = states[0].kind;
    this.x = x;
    this.y = y;
    this.height = height;
    this.width = width;
    this.state = states[0];
  }

}

function moveToendOfSVG(el){
  let parent = el.ownerSVGElement; //without this, weird DOM issues??
  parent.appendChild( el );
}

// View object
class View {
  constructor({name, parent, /*name to append to svg id; parent html node*/
    angleh, anglev, anglehs, anglevs, observation, distance,/*render settings*/
    squaresize, scale,/*    sizing settings*/
    sprites, viewBox, className /* sprites, each containing states, containing a pixel array*/}) {
      // console.log(sprites);
  	Object.assign(this, {name, parent, /*name to append to svg id; parent html node*/
      angleh, anglev, anglehs, anglevs, observation, distance,/*render settings*/
      squaresize, scale,/*sizing settings*/
      sprites, viewBox, className /* sprites, each containing states, containing a pixel array*/});


    if (!parent){
      console.log("Error: View() constructor received a null parent node.");

    }
    // to be populaed and used later:
    this.elemsObj = []; // objects for each element to be remdered
    this.elemsSVG = []; // the SVG string for each
    this.groups = {};
    this.oldOrder = '';
    this.newOrder = '';

    this.width = null;
    this.height = null;
    this.index = null;
    this.point = null;
    this.rgba = {};

    // center x and y
    // x is slightly offset
    this.x3dfactor = 0.6;
    this.y3dfactor = 0.6;

    this.x3d = this.viewBox[2] * this.x3dfactor;
    this.y3d = this.viewBox[3] * this.y3dfactor;

    // which wawy the scene is facing
    this.up = false;
    this.right = false;

    // generate the points based on each sprite's initial state,
    // and assign all the things that will be attributes of the svg element, to .state
    //NOTE: a bit confusing: there is at least 1 state for each "sprite". There is also a
    // "state" used by each element that reflects the current state to be rendered.
    for (var spri = 0; spri < this.sprites.length; spri+=1){
      let sp = this.sprites[spri];
      // console.log(sp.state.pathPoints);
      // console.log(sp.state.dmake(sp.state.pathPoints));
      this.groups[sp.state.group] = {
        name: sp.state.group,
        tags:[`<g id="elements_${this.name}_group_${sp.state.group}" index="${sp.state.group[sp.state.group.length-1]}">`,`</g>`],
        elems: [],
        dist: 0,
        index: 0
      };

    	this.elemsObj.push({
          ...sp.state,
          r: 1,
          untethered: this.sprites[spri].untethered,
          animation: this.sprites[spri].animation,
          kind: sp.kind,
          state: {
            fill: sp.state.fill=="none"?"none":`rgb(${sp.state.fill.join(", ")})`,
            'fill-opacity': sp.state['fill-opacity']=="none"?"none":sp.state['fill-opacity'],
            stroke: sp.state.stroke=="none"?"none":`rgb(${sp.state.stroke.join(", ")})`,
            'stroke-opacity': sp.state['stroke-opacity']=="none"?"none":sp.state['stroke-opacity'],
            d: sp.state.dmake(sp.state.pathPoints),
            'stroke-width': sp.state['stroke-width']?sp.state['stroke-width']:1,
          },
        });

    }

    // Assign the actual SVG:
    parent.innerHTML = `<svg id="svg_${this.name}"
                          class="${this.className}"
                            viewBox="${this.viewBox.join(" ")}"
                            preserveAspectRatio="none" >
                            <g id="elements_${this.name}"></g>
                          </svg>`;
    this.svg = document.getElementById(`svg_${this.name}`);
    console.log(`elements_${this.name}`);
    this.svgGroup = document.getElementById(`elements_${this.name}`);

    // Now make SVG strings for each element:
    this.elemsSVG = this.elemsObj.map( (d,i) => `\
      <${d.kind} class="${(d.untethered?'untethered':'tethered')} ${d.classes?d.classes.join(" "):""}"
        stroke-linecap="round"
        stroke-linejoin="round"
        ></${d.kind}>`);
        // index="${this.elemsSVG.length+i}" ></${d.kind}>`);

    // assign to groups
    this.elemsSVG.forEach((d,i) => this.groups[this.elemsObj[i].group].elems.push( d ) );

    // now join all groups together:
    this.svgGroup.innerHTML = ``;
    for (let prop in this.groups) {
      this.svgGroup.innerHTML+=`${this.groups[prop].tags.join(
        this.groups[prop].elems.join('')
      )}`;
    }
    // this.svgGroup.innerHTML = this.elemsSVG.join('');


    this.allNodes = this.svgGroup.querySelectorAll('g > path, g > rect, g > text');

    // store start time, for animation
    this.startTime = Date.now();


    // Setup and event listeners
    //
    // wrapper
    let eventwrap = (t, f) => this.svg.addEventListener(t, e => this.renderRects( f(e) ));

    // User actions
    // for clicking and dragging to rotate:
    eventwrap('click', evt => {
      evt.preventDefault();
      evt.stopPropagation();
      this.index = this.elemsObj[evt.target.getAttribute('index')]
    });
    // clear the point that was clicked on mousup
    eventwrap('mouseup', evt => this.point = null);
    // Get the point clicked
    eventwrap('mousedown', evt => this.point = { x: evt.x,
                                              y: evt.y,
                                              angleh: this.angleh,
                                              anglev: this.anglev});
    // if not null, move to new vertical and horizontal anlges while simultaneously
    // updating the stored horizontal and vertical angle values
    eventwrap('mousemove', evt => {
      evt.preventDefault();
      evt.stopPropagation();
      this.point && (this.angleh = this.point.angleh+(evt.x - this.point.x)/this.anglehs) + (this.anglev = this.point.anglev-(evt.y - this.point.y)/this.anglevs);
      // console.log("svg View mouse move");
    });

    // for scrolling to zoom:
    eventwrap('wheel', evt => {
      if (evt.ctrlKey) {
        // let hexContent = this.svg.parentNode.parentNode;
        // hexContent.style.overflow = "hidden";
        evt.preventDefault();
        evt.stopPropagation();
        this.observation *= 1-Math.sign(evt.deltaY)*0.015;

        // hexContent.style.overflow = "scroll";
      }
    });

    // resizing the parent element.
    //TODO: make more performant. There's currently a sort of debounce,
    // but there should just be an alternative to this.renderREcts()
    //  that just moves the current positions instead of re-rendering 3d
    this.debounceResize = false;
    this.resizeObs = new ResizeObserver(
      evt => {
        if (!this.debounceResize){
          this.renderRects();
          // console.log("svg View parentNode resized: just rendered.");
          this.debounceResize = true;
          setTimeout( () => {this.debounceResize = false;}, 200)
        }
      }
    ).observe(this.svg.parentNode);



    // Also set a timeout, so we can have animatinos play:
    // (not used here yet)
    // this.timeout = setInterval(() => this.renderRects(), 1000/30);

    // initial render
    this.renderRects();

  }

  project(el){
    // console.log('Here is where we would project a path');
    let pp = [];
    let rrr = Infinity; //
    let zd = 0;
    let count = 0;
    let distSum = 0;
    // console.log("el.pathPoints:");
    // console.log(el.pathPoints);
    for (let i=0; i < el.pathPoints.length; i++){

      let pt = el.pathPoints[i];
      // console.log( el.pathPoints[i]);
      // Indexing past the array length, as in for extras, should still work:
      if (!el.fixedPoints[i]){
        // console.log("not fixed");
        // console.log(pt);
        // Note the x, y, and z are set up such that z is up,
        // because we assume paths are expected to be more conventional 3D
        let ptx = pt[0];
        let pty = -pt[2];
        let ptz = pt[1];
        let x = ptx*cos(-this.angleh) + ptz*sin(-this.angleh);
        let z = ptz*cos(-this.angleh) - ptx*sin(-this.angleh);
        let y = pty*cos(this.anglev) + z*sin(this.anglev);
        let dist = z*cos(this.anglev) - pty*sin(this.anglev) + this.distance;
        distSum+=dist;
        // let x = pt[0]*cos(this.angleh) + pt[2]*sin(this.angleh);
        // let z = pt[1]*cos(this.angleh) + pt[0]*sin(this.angleh);
        // let y = -pt[2]*cos(this.anglev) + z*sin(this.anglev);
        // let dist = z*cos(this.anglev) + pt[2]*sin(this.anglev) + this.distance;
        // console.log(`(this.observation/dist)*x + this.width: ${[this.observation,dist,x,this.width]}`);
        // pp.push( [(this.observation/dist)*x + this.width/2,
        //                   (this.observation/dist)*y + this.height/2] );
        // pp.push( [(this.observation/dist)*x + this.viewBox[2]/2,
        //                   (this.observation/dist)*y + this.viewBox[3]/2]  );
        // pp.push( [ (this.observation/dist)*x + this.x3d,
        //            (this.observation/dist)*y + this.y3d ]  ); // perspective
        pp.push( [ (this.observation*x) + this.x3d,
                   (this.observation*y) + this.y3d ]  ); // ortho/no perspective

        // Here's where we'd resize the rect element based on z-distance,
        // or radius if using circles
        rrr = Math.min(rrr, this.distance/dist*el.r);
        count++;
      }
      else{
        // console.log("fixed");
        pp.push( [pt[0], pt[1]] ); // or should it be pt[2]. ..?
      }
    }
    // console.log(`rr:4${rr}`);

    // Form the path string from the coordinates we just updated
    // console.log('path pts in project:');
    // console.log(pathPts);

    // can move this to a function/method of this object/elements?
    // console.log(pp);
    el.state.d = el.dmake(pp, this.right, this.up );
    el.state.r = rrr;
    this.groups[el.group].dist+= distSum/count;

    // console.log(px);
    // console.log(`px.state.x, px.state.y, px.state.z,dist,r: ${[px.state.x,px.state.y,px.state.z,dist,px.state.r]}`);

  }

  renderRects(){

    // this.pixels.forEach( (d) => this.project(d));
    // this.pixels.sort( (a,b) => a.state.r - b.state.r );
    // // unpack attributes
    // this.pixels.forEach( (d, i) => Object.entries(d.state)
    //   .forEach(e => this.rectNodes[i].setAttribute(...e)));

    // to help center:

    const bbox = this.svg.getBoundingClientRect();
    //HACK: exit the render if there is a null parent node
    if (!this.svg.parentNode) return 1;
    const pbox = this.svg.parentNode.getBoundingClientRect();
    // const xsc = bbox.height/(bbox.width);
    // console.log(this.svg.parentNode);
    // console.log(pbox);
    // console.log(this.svg);
    // console.log(bbox);
    if (pbox.width > 0){
      this.x3d = this.svg.viewBox.animVal.width *this.x3dfactor * pbox.width/bbox.width;
    }

    // Determine which way the 3d scene is facing based on rotation:
    // this.up = Math.floor( (this.anglev+Math.PI) / Math.PI ) % 2
    // works for positive but not negative:
    // this.up = Math.floor( Math.abs( (this.anglev+Math.PI)/Math.PI))%2;
    // this.right = Math.floor( Math.abs( (this.angleh+Math.PI)/Math.PI))%2;

    // probably a more efficient way...
    let au = (this.anglev+Math.PI)%(Math.PI*2);
    this.up = ( au < 0 ? au+(Math.PI*2) : au ) >= Math.PI;
    let ar = (this.angleh+Math.PI)%(Math.PI*2);
    this.right = ( ar < 0 ? ar+(Math.PI*2) : ar ) >= Math.PI;


    // console.log( `up ${this.up}   right ${this.right}     h ${this.angleh} rad, v ${this.anglev} rad` );



    // console.log(this.x3d);

    // let hyphenate = {
    //   fillOpacity: "fill-opacity",
    //   strokeOpacity: "stroke-opacity"
    // }
    // this.allElements



    for (let g in this.groups) this.groups[g].dist = 0; // Clear the values in group's distance

    // project
    // this.elemsObj.forEach( (d) => this.project(d));

    // average groups' new dist values
    // for (let g in this.groups){
    //   this.groups[g].dist/= this.groups[g].elems.length;
    // }


    this.elemsObj.forEach( (d) => this.project(d));

    for (let g in this.groups) this.groups[g].dist/= this.groups[g].elems.length; // average group's new dist values



    // Sort the groups (descending, because further back will be higher, we "paint" that first)
    // this.elemsObj.sort( (a,b) => a.state.r - b.state.r );
    //TODO: maybe only sort if we enter a new octant, based on this.up and this.right changing?
    this.groupsArray = Object.entries( this.groups ).sort( (entryA,entryB) => entryA[1].dist - entryB[1].dist ).reverse().map( d => d[1] );


    // this.newOrder = this.groupsArray.map( d => `${d.name}[${Math.round(d.dist)}]`).join(' -> ');
    this.newOrder = this.groupsArray.map( d => `${d.name}`).join(' -> ');
    let orderChange = this.newOrder+'' != this.oldOrder+'';
    if (orderChange) console.log( this.newOrder );
    this.oldOrder = this.newOrder+'';
    // console.log(this.groupsArray);



    // this.elemsObj.sort( (a,b) => a.state.r - b.state.r );

    // unpack attributes
    //HACK: uses dictionary to replace certain keys with a hyphenated version,
    // probably a more efficient method to do this...
    // this.elemsObj.forEach( (d, i) => Object.entries(d.state)
    //   .forEach(e => this.allNodes[i].setAttribute(
    //     hyphenate[e[0]] ? hyphenate[e[0]] : e[0], e[1] )
    //   )
    // );
    if (orderChange) {
      for (let i=0; i < this.groupsArray.length; i++){
        let key = this.groupsArray[i].name;

        this.elemsObj.forEach(
          (d, i) => {
            if (d.group==key) {
              moveToendOfSVG(this.allNodes[i]);
              Object.entries(d.state).forEach( e => this.allNodes[i].setAttribute( e[0], e[1] ) );
            }
          }
        );
      }
    }
    else{
      this.elemsObj.forEach(
          (d, i) => Object.entries(d.state).forEach( e => this.allNodes[i].setAttribute( e[0], e[1] ) )
        );
    }


  }

  newFrame(){
    // This will move to the next frame (pixels of the next state for a sprite)
    return 0
  }

}


function makeBitplaneSVG(parent, name, dat, angleh=0, anglev=0, observation=1, palette=null){

  //NOTE: this uses format "bitplane 0" as first bp index... not bp 1.

  if (!parent) {
    // console.log("Error: parent element passed to makeBitplaneSVG() is null.");
    return null;
  }

  let curvs = [];
  // console.log(dat);
  // console.log(parent);
  if (!dat){
    dat = Array.from(Array(32)).map(d=> Math.round(Math.random()*255));
  }

  // console.log("received palette...");
  // console.log(palette);

  // console.log("Generating svg with palette...");
  // console.log(pal);
  // A lot of variables... maybe too much, but should simplify later...
  // byte column / 2d svg fixed coordinates

  // let bprgbfg = [
  //   [127,127,127],
  //   [255,255,255],
  //   [127,127,127],
  //   [0,0,0]
  // ]; // colors for stroke of each bitplane
  // let bprgbbg = [
  //   [0,0,0],
  //   [127,127,127],
  //   [255,255,255],
  //   [127,127,127]
  // ]; // background

  // let bprgbfg = [
  //   [127,127,127],
  //   [212,212,212],
  //   [42,42,42],
  //   [127,127,127]
  // ]; // colors for stroke of each bitplane
  let bprgbfg = [
    [255,255,255],
    [255,255,255],
    [0,0,0],
    [0,0,0]
  ]; // colors for stroke of each bitplane
  let bprgbbg = [
    [0,0,0],
    [85,85,85],
    [170,170,170],
    [255,255,255]
  ]; // background

  // (also used by indices square):
  var textDefaults = {
    fill: "none",
    'fill-opacity': 0,
    stroke: [255, 255, 255],
    'stroke-opacity': 0.95,
    'stroke-width': 1,
  };
  var solidsDefaults = {
    'fill-opacity': 1,
    'stroke-opacity': 0.0,
    'stroke-width': 2,
  };
  // arrows:
  var outlinesDefaults = {
    fill: "none",
    'fill-opacity': "0",
    'stroke-opacity': 0.95,
    'stroke-width': 1,
  }


  let height = 1000;
  let bscx = 80;
  let bscy = height/32;


  // weird 3d coordinates:
  // let scx = 50/2;
  // let scy = 50/2;
  let scx = 25;
  let scy = 25;
  let scz = 120;
  // let bpcx = 10*scx;
  let bpcx = 0; //default 0?
  // let bpcy = 16*scy;
  let bpcy = 0;
  let bps = scy*16; // bitplane side
  let bpc = bps/8; // bitplane cell length
  let bpch = bps/16; // bitplane cell length half
  let bpcq = bps/32; // bitplane cell length quarter

  let bpl = bpcx-(bps/2); // bitplane left edge
  let bpll = bpl-(6*scx); // slightly left of bitplane left edge
  let arrowHandle = bpl - (5*bpc);
  let arrowHead = bpl - (0.45*bpc);
  let arrowTip = bpl - (0.2*bpc);


  // let bpd = 1.5*scz; // pb 0 depth
  let bpd = 1.5*bpc*8; // pb 0 depth
  let indexplane = -1.5; // remember bp 0 will be 0, bp 1 will be 1, etc
  scz = bpc*8;
  let bpt = bpcy-(bps/2); // bitplane top edge
  let bptph = -(bpt + bpch); // top plus half a cell length

  let bpnz = bpd/100; // bit plane numbers z depth (offset from their plane)

  // text height, width, x and y offsets
  // let txthsc = 0.5;
  // let txtwsc = 0.25;
  let txthsc = 1;
  let txtwsc = 1;
  let txthu = txthsc *bpc; // not pre-scaled
  let txtwu = txtwsc *bpc;
  let txth = txthsc *bpc/8; // pre-scaled by 8 so it can be multiplied by numsvg
  let txtw = txtwsc *bpc/8;
  let txty = ( bpc - (bpc * txthsc) )/2;
  let txtx = ( bpc - (bpc * txtwsc) )/2;


  let bpr = [0,0,0,0]; // bitplane rows completed


  // setup for data
  var numsvg = {
    "0":[ [3,1],  [5,1],  [6,2],  [6,6],  [5,7],  [3,7],  [2,6], [2,2], [3,1]  ],
    "1":[ [3,2],  [4,1],  [4,7],  [5,7],  [3,7] ],
    "2":[ [2,2], [3,1], [5,1], [6,2], [2,7], [6,7] ],
    "3":[ [2,2], [3,1], [5,1], [6,2], [6,3], [5,4], [3,4], [5,4], [6,5], [6,6], [5,7], [3,7], [2,6] ],
    "4":[ [6,5], [2,5], [5,1], [5,7]],
    "5":[ [6,1], [2,1], [2,4], [3,3], [5,3], [6,4], [6,6], [5,7], [3,7], [2,6] ],
    "6":[ [5,1], [3,1], [2,2], [2,6], [3,7], [5,7], [6,6], [6,4], [5,3], [3,3], [2,4] ],
    "7":[ [2,1], [6,1], [5,2], [3,7] ],
    "8": [ [5,4], [3,4], [2,3], [2,2], [3,1], [5,1], [6,2], [6,3], [5,4], [6,5], [6,6], [5,7], [3,7], [2,6], [2,5], [3,4] ],
    "9": [ [6,4], [3,4], [2,3], [2,2], [3,1], [5,1], [6,2], [6,4], [3,7] ],
    "10": [ [2,7], [2.5,5.5], [5.5,5.5], [2.5,5.5], [4,1], [6,7] ],
    // "11": [ [5,4], [2,4], [2,1], [5,1], [6,2], [6,3], [5,4], [6,5], [6,7], [2,7], [2,4] ],
    "11": [ [2,1], [5,1], [6,1.5], [6,2.5], [5,3], [2.5,3], [5,3], [6,4], [6,6], [5,7], [2,7], [2.5,7], [2.5,1] ],
    "12": [ [6,6],  [5,7],  [3,7],  [2,6], [2,2], [3,1],  [5,1],  [6,2]  ],
    "13": [ [2,1],  [5,1],  [6,2],  [6,6],  [5,7],  [2,7], [2.5,7], [2.5,1]   ],
    "14": [ [6,1], [2,1], [2,4], [5,4], [2,4], [2,7], [6,7] ],
    "15": [ [6,1], [2,1], [2,4], [5,4], [2,4], [2,7] ],

  }
  // convert values to strings:
  // data = data.map(
  //   d =>  Array.from(Array(8).keys()).reduce(
  //       (accum, val, i) => accum+= `${ (d  & (0b10000000 >> i)) >> (7-i)}`, ``)
  //   );
  var data = [];
  // console.log(dat);
  for (let i=0; i<dat.length; i++){
    data.push( binar( dat[i] ) );
    // console.log( [i, binar( dat[i] )] );
  }

  while(data.length<32) data.push( '00000000' ); // zero fill if needed
  // dat.forEach( d => data.push( binar( d ) ) );

  let tile = zeros(8,8);

  // console.log(data);

  let dataPaths = [];

  for (let i=0; i<32; i++){

    let bp = ((i>15)*2) + i%2;
    // console.log(`Y 2D coord: ${(i+0.5)*bscy}`);
    // cast from string to number, shift left the appropriate amount, or this to the value
    for (let j=0; j<8; j++) tile[bpr[bp]][j] |= (1*data[i][j]) << bp;

    // ARROWS
    //
    // Add the arrows going from left side of SVG to left side of each bitplane
    // note that y and z are swapped weirdly...
    // BG ARROW
    curvs.push(
      new Sprite([
      new State(
        {
          pathPoints: [
            [0, (i+0.5)*bscy, 0],
            [bscx, (i+0.5)*bscy, 0],
            [arrowHandle, bpd-(bp*scz), bptph-(bpr[bp]*bpc)],
            [arrowTip, bpd-(bp*scz), bptph-(bpr[bp]*bpc)],

            [arrowHead, bpd-(bp*scz), bptph-(bpr[bp]*bpc)-bpcq],
            [arrowTip, bpd-(bp*scz), bptph-(bpr[bp]*bpc)],
            [arrowHead, bpd-(bp*scz), bptph-(bpr[bp]*bpc)+bpcq]
          ],
          fixedPoints: [true, true, false, false],
          ...outlinesDefaults,
          stroke: bprgbbg[bp],
          'stroke-width': 5,
          group: `bp${bp}`,
          dmake(p){
            return `M ${p[0].join(" ")} \
                    C ${p.slice(1,4).map(e => e.join(" ")).join(", ")} \
                    L ${p.slice(4).map(e => e.join(" ") ).join(" L ")}`;
          }
        },
        'path')
      ], 0,0,0,0)
    );
    // FG ARROW
    // (removed: too busy-looking)
    // curvs.push(
    //   new Sprite([
    //   new State(
    //     {
    //       pathPoints: [
    //         [0, ((i+0.5)*bscy) - bpnz, 0],
    //         [bscx, ((i+0.5)*bscy) - bpnz, 0],
    //         [arrowHandle, bpd - (bp*scz) - bpnz, bptph-(bpr[bp]*bpc)],
    //         [arrowTip, bpd - (bp*scz) - bpnz, bptph-(bpr[bp]*bpc)],

    //         [arrowHead, bpd - (bp*scz) - bpnz, bptph-(bpr[bp]*bpc)-bpcq],
    //         [arrowTip, bpd - (bp*scz) - bpnz, bptph-(bpr[bp]*bpc)],
    //         [arrowHead, bpd - (bp*scz) - bpnz, bptph-(bpr[bp]*bpc)+bpcq]
    //       ],
    //       fixedPoints: [true, true, false, false],
    //       ...outlinesDefaults,
    //       stroke: bprgbfg[bp],
    //       'stroke-width': 2,
    //       group: `bp${bp}`,
    //       dmake(p){
    //         return `M ${p[0].join(" ")} \
    //                 C ${p.slice(1,4).map(e => e.join(" ")).join(", ")} \
    //                 L ${p.slice(4).map(e => e.join(" ") ).join(" L ")}`;
    //       }
    //     },
    //     'path')
    //   ], 0,0,0,0)
    // );

    // 1S AND 0S
    //
    // Now do the data: numeric characters
    // (working "up" from the "next" row since we already incremented bpr[bp])
    for (let j=0; j<8; j++){
      // console.log( data[i][j]);
      dataPaths.push(
      new Sprite([
        new State(
          {
            pathPoints: numsvg[data[i][j]].map(
              (d,ii) => [
                bpl + (bpc*j) + (d[0]*txtw) + txtx,
                bpd-(bp*scz)-bpnz,
                -bpt - (bpc*bpr[bp]) - (d[1]*txth) - txty
              ] ),
            fixedPoints: [],
            ...textDefaults,
            stroke: bprgbfg[bp],
            group: `bp${bp}`,
            dmake(p){
              return `M${(p.map(e => e[0]+','+e[1])).join(" L")}`;
            }
          },
          'path')
        ], 0,0,0,0)

    )
    }


    bpr[bp]++; // increment to next row


  }

  // setup for pixel bubbles/boxes
  //
  // txthu
  // txtwu
  // txty
  // txtx
  let txthscbox = txthsc * 1.5;
  let txtwscbox = txtwsc * 1.5;
  let txthbox = txthscbox *bpc; // not pre-scaled
  let txtwbox = txtwscbox *bpc;
  let txtybox = ( bpc - (bpc * txthscbox) )/2;
  let txtxbox = ( bpc - (bpc * txtwscbox) )/2;
  // var cornersFront = [ [0,0], [0,1], [1,1], [1,0] ];
  // var cornersBack = [ [1,1], [1,0], [0,0], [0,1] ];
  var cornersFront = [ [0,0], [0,0.5], [0,1], [0.5,1], [1,1], [1,0.5], [1,0], [0.5,0] ];
  var cornersBack = [ [1,1],  [1,0.5], [1,0], [0.5,0], [0,0], [0,0.5], [0,1], [0.5,1] ];

  for (let i=0; i<8; i++){

    for (let j=0; j<8; j++){


      // INDICES CHARACTERS 0-F
      //
      dataPaths.push(
      new Sprite([
        new State(
          {
            pathPoints: numsvg[tile[i][j]].map(
              (d,ii) => [
                bpl + (bpc*j) + (d[0]*txtw) + txtx,
                bpd-(indexplane*scz)-bpnz,
                -bpt - (bpc*i) - (d[1]*txth) - txty
              ] ),
            fixedPoints: [],
            ...textDefaults,
            'stroke-opacity': 1,
            group: `indices`,
            classes: [`${tile[i][j]}`],
            dmake(p){
              return `M${( p.map(e => e.join(", ") )).join(" L")}`;
            }
          },
          'path')
        ], 0,0,0,0)
      );

      // PIXEL SQUARES
      //
      if (palette != null ) dataPaths.push(
        new Sprite([
          new State(
            {
              pathPoints: [
                [ bpl + (bpc*j) ,  bpd-(indexplane*scz), -bpt - (bpc*i) ],
                [ bpl + (bpc*j) + bpc ,  bpd-(indexplane*scz), -bpt - (bpc*i) ],
                [ bpl + (bpc*j) + bpc ,  bpd-(indexplane*scz), -bpt - (bpc*i) - bpc],
                [ bpl + (bpc*j) ,  bpd-(indexplane*scz), -bpt - (bpc*i) - bpc]
              ],
              fixedPoints: [],
              fill: palette[ tile[i][j] ],
              stroke: [0,0,0],
              'stroke-opacity': 0,
              'fill-opacity': 0.9,
              group: `pixels`,
              classes: [`pixels_${tile[i][j]}`],
              dmake(p){
                return `M${( p.map(e => e.join(", ") )).join(" L")} z`;
              }
            },
            'path')
          ], 0,0,0,0)
        );

    // PIXEL BUBBLES
    //
    // dataPaths.push(
    //   new Sprite([
    //     new State(
    //       {
    //         pathPoints: [
    //           ...cornersFront.map(
    //             (d,ii) => [
    //               bpl + (bpc*j) + (d[0]*txtwbox) + txtxbox,
    //               bpd-( 3 *scz)-bpnz,
    //               -bpt - (bpc*i) - (d[1]*txthbox) - txtybox
    //             ]
    //           ),
    //           ...cornersBack.map(
    //             (d,ii) => [
    //               bpl + (bpc*j) + (d[0]*txtwbox) + txtxbox,
    //               bpd-(indexplane*scz)-bpnz,
    //               -bpt - (bpc*i) - (d[1]*txthbox) - txtybox
    //             ]
    //           )
    //         ],
    //         fixedPoints: [],
    //         ...textDefaults,
    //         group: `boxes`,
    //         classes: [`box_${tile[i][j]}`],

    //         dmake(p, right, up){
    //           //HACK: convenient but might be slow...
    //           let n = p.map( d => d.join(",") );
    //           let f = n.slice(0,8); // front
    //           let b = n.slice(8); // back
    //           // let y = (p[1][1] + p[0][1]) / 2;
    //           // let x = (p[3][0] + p[0][0]) / 2;
    //           // console.log(`y = (${p[1][1]} - ${p[0][1]}) / 2 = ${y} <-> ymid ${ymid}\nx = (${p[3][0]} - ${p[0][0]}) = ${x} <-> xmid ${xmid}`);
    //           //TODO: this could be way cleaner...      arrows front to back ( bp 3-> 2 -> 1 -> 0 -> index ) [opposite of what object is "facing", towards viewer...]
    //           // if ( !right ){
    //           //   if ( !up) return `M${p[0].join(",")} C${p[1].join(",")},${p[1].join(",")},${p[2].join(",")} L${p[4].join(",")} C${p[5].join(",")},${p[5].join(",")},${p[6].join(",")} Z`; //   ↗
    //           //   if ( up ) return `M${p[3].join(",")} C${p[0].join(",")},${p[0].join(",")},${p[1].join(",")} L${p[7].join(",")} C${p[4].join(",")},${p[4].join(",")},${p[5].join(",")} Z`; //   ↘
    //           // }
    //           // else if ( right ) {
    //           //   if ( !up) return `M${p[1].join(",")} C${p[2].join(",")},${p[2].join(",")},${p[3].join(",")} L${p[5].join(",")} C${p[6].join(",")},${p[6].join(",")},${p[7].join(",")} Z`; //   ↖
    //           //   if ( up ) return `M${p[2].join(",")} C${p[3].join(",")},${p[3].join(",")},${p[0].join(",")} L${p[6].join(",")} C${p[7].join(",")},${p[7].join(",")},${p[4].join(",")} Z`; //   ↙ GOOD
    //           // }
    //           // we are sort of wrapping around the points counterclockwise depending on which direction.
    //           let o = 0;
    //           if ( !right ){
    //             if ( !up) o = 0; //   ↗
    //             if ( up ) o = 6; //   ↘
    //           }
    //           else if ( right ) {
    //             if ( !up) o = 2; //   ↖
    //             if ( up ) o = 4; //   ↙
    //           }
    //           // return `M${p[0].join(",")} C${p[1].join(",")},${p[1].join(",")},${p[2].join(",")} L${p[4].join(",")} C${p[5].join(",")},${p[5].join(",")},${p[6].join(",")} Z`;
    //           return `\
    //             M ${f[(1+o)%8]}
    //             C ${f[(2+o)%8]},${f[(2+o)%8]},${f[(3+o)%8]}
    //             C ${f[(4+o)%8]},${b[(0+o)%8]},${b[(1+o)%8]}
    //             C ${b[(2+o)%8]},${b[(2+o)%8]},${b[(3+o)%8]}
    //             C ${b[(4+o)%8]},${f[(0+o)%8]},${f[(1+o)%8]}`;
    //         }
    //       },
    //       'path')
    //     ], 0,0,0,0)
    //   );

    }
  }

  // ARROW TOWARD INDICES PLANE
  //
  // INDICES CHARACTERS 0-F
  //
  dataPaths.push(
  new Sprite([
    new State(
      {
        pathPoints: [
           [
            0,
            bpd-(indexplane*0.35*scz) ,
            0
          ],
          [
            0,
            bpd-(indexplane*0.6*scz) ,
            0
          ],
          [
            bpc,
            bpd-(indexplane*0.525*scz) ,
            0
          ],

          [
            0,
            bpd-(indexplane*0.6*scz) ,
            0
          ],
          [
            -bpc,
            bpd-(indexplane*0.525*scz) ,
            0
          ],

          [
            0,
            bpd-(indexplane*0.6*scz) ,
            0
          ],
        ],
        fixedPoints: [],
        ...textDefaults,
        group: `indicesArrow`,
        classes: [`arrowToIndicesPlane`],
        dmake(p){
          return `M${( p.map(e => e.join(", ") )).join(" L")}`;
        }
      },
      'path')
    ], 0,0,0,0)
  );

  //
  // BITPLANE SQUARES
  //
  let bprects = [];

  for (let bp=0;bp<4;bp++){

    bprects.push(
      new Sprite([
        new State(
          {
            pathPoints: [
              [bpl, bpd-(bp*scz), bpt],
              [bpl+bps, bpd-(bp*scz), bpt],
              [bpl+bps, bpd-(bp*scz), bpt+bps],
              [bpl, bpd-(bp*scz), bpt+bps]
            ],
            fixedPoints: [],
            ...solidsDefaults,
            fill: bprgbbg[bp],
            stroke: bprgbfg[bp],
            group: `bp${bp}`,
            dmake(p){
              return `M${([...p,p[0]].map(e => e[0]+','+e[1])).join(" L")}`;
            }
          },
          'path')
        ], 0,0,0,0)
    );

  }

  //
  // INDICES PLANE SQUARE
  //
  //TODO: break this into a separate function to be called for both bitplanes and indices plane?
  let bp = indexplane;
  bprects.push(
      new Sprite([
        new State(
          {
            pathPoints: [
              [bpl, bpd-(bp*scz), bpt],
              [bpl+bps, bpd-(bp*scz), bpt],
              [bpl+bps, bpd-(bp*scz), bpt+bps],
              [bpl, bpd-(bp*scz), bpt+bps]
            ],
            fixedPoints: [],
            ...textDefaults,
            'stroke-opacity':0,
            group: `indices`,
            dmake(p){
              return `M${([...p,p[0]].map(e => e[0]+','+e[1])).join(" L")}`;
            }
          },
          'path')
        ], 0,0,0,0)
    )

  // return [curvs, bprects];
  // var bpsvg = makeBitplaneSVG();

  // console.log("all paths:");
  // console.log([...curvs, ...bprects, ...dataPaths]);

  return new View({
    name: name,
    parent: parent, /* replace with document.body for safe / reliable functioning */
    angleh: angleh,
    anglev: anglev,
    anglehs: 100,
    anglevs: 100,
    observation: observation,
    distance: 1,
    squaresize: 1,
    scale: 1,
    sprites: [...curvs, ...bprects, ...dataPaths],
    viewBox: [0, 0, height*0.75, height],
    className: "bpsvg",
    // sprites: [...segments, head11],
  });



}


// var bpsvg = makeBitplaneSVG();
//
//
// var view2 = new View({
//   name: '2',
//   parent: document.body, /* replace with document.body for safe / reliable functioning */
//   angleh: 0,
//   anglev: 0,
//   anglehs: 100,
//   anglevs: 100,
//   observation: 1000,
//   distance: 1000,
//   squaresize: sqs,
//   scale: 1,
//   sprites: [...bpsvg[0], ...bpsvg[1]],
//   // sprites: [...segments, head11],
// });
//NOTES:
//
// WEIRD MODE
// set distance and observation to a small number, like 10, and
// rotate to see the pixels wrap around to the other side of the screen.
//
// ISOMETRIC-ISH MODE (already default now)
// Set distance much higher than observation. Ex: dist 100000, obser 100.
// You'll have to zoom in or scale everything appropriately, but it should look
// more isometric. Scale=1 works well, but might not matter??
//
