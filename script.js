/* Main script for physics engine */
/* Author: Peter Hess
 * Year: 2020
 */

 /**** GLOBAL VARIABLES ****/
 var mode = 0; // Current Action mode
 var animate = false;
 var drawType = 0;
 var computeType = 0;
 var meterPerPixel = 1e-10;
 
 const particleRadius = 10;
 var particles = [];
 class Particle {
     constructor(charge, m, x, y){
         this.charge = charge;
         this.xcoord = x;
         this.ycoord = y;
         this.mass = m;
     }
 }
 /**** END GLOBAL VARIABLES ****/

/***** MATHEMATICAL CONSTANTS *****/
const epsilon_0 = 8.8541878128e-12;
const k = 8.9876e9;
const mu_0 = Math.PI * 4e-7;
/***** END MATHEMATICAL CONSTANTS *****/

/**** ENUMS ****/
const Actions = Object.freeze({
    "animate": 0, 
    "freeze": 1, 
    "draw": 2, 
    "calculate": 3});

const DrawObj = Object.freeze({"particle": 0, "wire": 1, "solidconductor": 2});

const Computation = Object.freeze({
    "force": 0, 
    "electricpotential": 1, 
    "electricpotentialenergy": 2,
    "electricfield": 3,
    "distance": 4});
/**** END ENUMS ****/

// Returns a valid float value from the user
function promptFloat(promptStr, defaultVal = "") {
    var val = NaN;
    while (isNaN(val)){
        var r = prompt(promptStr, defaultVal);
        if (r == null){
            return null;
        }
        else {
            val = parseFloat(r);
        }
    }
    return val;
}

/* Event delegator for myCanvas */
function OnCanvasClick(canvas) {
    if (mode == Actions.draw){
        draw(canvas, event);
    }
    else if (mode == Actions.calculate) {
        compute(event);
    }
}

/* Handles drawing events on the canvas */
function draw(cvs, e){
    switch(drawType){
        case DrawObj.particle:
            var q = promptFloat("Enter charge in Coulombs (Use E syntax for exponents).", "1.602e-19");
            var m = promptFloat("Enter mass in Kg (Use E syntax for exponents).", "9.11e-31");

            if (q == null || m == null){
                break;
            }

            drawParticle(cvs, e.pageX, e.pageY, particleRadius);
            
            particles.push(new Particle(q, m, e.pageX, e.pageY));
            break;
        default:
    }
}

/***** Drawing Helpers *****/

/*  Draw circle of radius r at (x,y) 
    Note: coordinates should be relative to window, NOT canvas]
*/
function drawParticle(cvs, x, y, r){
    var xShift = cvs.getBoundingClientRect().left;
    var yShift = cvs.getBoundingClientRect().top;
    var ctx = cvs.getContext("2d");
    ctx.beginPath();
    ctx.arc(x-xShift, y-yShift, r, 0, 2 * Math.PI);
    ctx.fillStyle = "red";
    ctx.fill();
}

/*  
    Compute E over the canvas at 50 px increments. 
    Draw arrows in direction of E at each increment with magnitude (E(i,j) / r * scaleFactor) pixels
*/
function drawEField() {
    var c = document.getElementById("myCanvas");
    var w = c.width;
    var h = c.height;

    var pixelScale = 2;
    var xShift = c.getBoundingClientRect().left;
    var yShift = c.getBoundingClientRect().top;

    var E0 = electricfield(xShift, yShift)
    var norm = Math.sqrt(Math.pow(E0[0], 2) + Math.pow(E0[1], 2)) / pixelScale;

    for (var i = 0; i < h; i += 50) {
        for (var j = 0; j < w; j+= 50){
            var E = electricfield(j + xShift, i + yShift);
            //if (Math.abs(E[0]/norm) < 300 && Math.abs(E[0]/norm) < 300){
                drawArrow(j, i, j + E[0]/norm, i - E[1]/norm);
            //}
        }
    }
}

/*  
    Clear canvas and draw the original particle config 
*/
function redrawInitialParticles() {
    var c = document.getElementById("myCanvas");
    var ctx = c.getContext("2d");

    ctx.clearRect(0, 0, c.width, c.height);

    for (var i = 0; i < particles.length; i++){
        var p = particles[i];
        drawParticle(c, p.xcoord, p.ycoord, particleRadius);
    }
}

// https://stackoverflow.com/a/26080467
function drawArrow(fromx, fromy, tox, toy){
    //variables to be used when creating the arrow
    var c = document.getElementById("myCanvas");
    var ctx = c.getContext("2d");
    var headlen = 3;

    var angle = Math.atan2(toy-fromy,tox-fromx);

    //starting path of the arrow from the start square to the end square and drawing the stroke
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.strokeStyle = "#cc0000";
    ctx.lineWidth = 2;
    ctx.stroke();

    //starting a new path from the head of the arrow to one of the sides of the point
    ctx.beginPath();
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox-headlen*Math.cos(angle-Math.PI/7),toy-headlen*Math.sin(angle-Math.PI/7));

    //path from the side point of the arrow, to the other side point
    ctx.lineTo(tox-headlen*Math.cos(angle+Math.PI/7),toy-headlen*Math.sin(angle+Math.PI/7));

    //path from the side point back to the tip of the arrow, and then again to the opposite side point
    ctx.lineTo(tox, toy);
    ctx.lineTo(tox-headlen*Math.cos(angle-Math.PI/7),toy-headlen*Math.sin(angle-Math.PI/7));

    //draws the paths created above
    ctx.strokeStyle = "#cc0000";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#cc0000";
    ctx.fill();
}
/***** End Drawing Helpers *****/


// TODO have a distance computation option
/* Handles calculation events on canvas */
function compute(e){

    var formatNum = function (x){
        if (x.toPrecision(3).includes("e")){
            return  "(" + x.toPrecision(3).replace("e", "\\times 10^{") + "})";
        }
        else {
            return  "(" + x.toPrecision(3) + ")";
        }
    } 

    switch(computeType){
        case Computation.force:
            var p = clickedOnParticle(e.x, e.y);
            var F = [];
            if (p) {
                F =  force(p.charge, p.xcoord, p.ycoord);
            } else{
                var q = promptFloat("Enter charge in Coulombs.", "1.602e-19");
                F = force(q, e.x, e.y);
            }
            document.getElementById("calc-out").textContent = "\\(" +  formatNum(F[0]) + " \\hat{\\imath} + " + formatNum(F[1]) + " \\hat{\\jmath}\\) N";
            break;
        case Computation.electricpotential:
            var V = electricpotential(e.x, e.y);
            document.getElementById("calc-out").textContent = "\\(" + formatNum(V) + "\\) V";
            break;
        case Computation.electricpotentialenergy:
            var U = electricpotentialenergy();
            document.getElementById("calc-out").textContent = "\\(" + formatNum(U) + "\\) J";
            break;
        case Computation.electricfield:
            var E = electricfield(e.x, e.y);
            document.getElementById("calc-out").textContent = "\\(" +  formatNum(E[0]) + " \\hat{\\imath} + " + formatNum(E[1]) + " \\hat{\\jmath}\\) V/m";
            break;
        case Computation.distance:
            // TODO need global var for first point
            if (true) { // if global is null
                // global = [e.x, e.y];
            }
            else {
                var d = Math.sqrt(distanceSqrd(e.x, e.y, x, y));
                document.getElementById("calc-out").textContent = "\\(" + formatNum(d) + "\\) m";
                // reset global to null
            }
            break;
    }
    renderMathInElement(document.getElementById("calc-out"));
}

/* 
    Shows how particles would move over time.

    Option to include traces and to restart to the original position
*/
function animate(){
    // initialize
    var curr = [], delta_x = [];
    for (var i = 0; i < particles.length; i++){
        var p = particles[i];
        curr.push(new Particle(p.charge, p.mass, p.xcoord, p.ycoord));
    }

    var c = document.getElementById("myCanvas");
    var ctx = c.getContext("2d");

    var dt = 0.5 * Math.pow(document.getElementById("deltaT").value, 2);
    var p, F;
    var delta_x = Array(curr.length).fill(0).map(x => Array(2).fill(0));

    // TODO add freeze mode
    while(mode == Actions.animate){
        for (var i = 0; i < particles.length; i++){
            p = curr[i];
            F = force(p.charge, p.xcoord, p.ycoord, curr);
            delta_x[i][0] = F[0] * (dt/p.mass);
            delta_x[i][1] = F[1] * (dt/p.mass);
        }

        ctx.clearRect(0, 0, c.width, c.height);

        for (var i = 0; i < particles.length; i++){
            curr[i].xcoord += delta_x[i][0];
            curr[i].ycoord += delta_x[i][1];
            drawParticle(ctx, curr[i].xcoord, curr[i].ycoord, particleRadius);
        }
    }
}

// Handler for animate restart 
function AnimateRestart() {
    redrawInitialParticles();
    animate();
}

/***** COMPUTATIONAL FUNCTIONS *****/
/* Standard euclidean distance */
function distanceSqrd(x1, y1, x2, y2) {
    return Math.pow((x1-x2)*meterPerPixel, 2) 
                        + Math.pow((y1-y2)*meterPerPixel, 2);
}

/* Returns particle[i] if (x,y) is within that particle; otherwise null */
function clickedOnParticle(x, y){
    var particle = null;
    
    for (var i = 0; i < particles.length; i++){
        var p = particles[i];
        if (Math.sqrt(distanceSqrd(x, y, p.xcoord, p.ycoord)) < particleRadius*meterPerPixel){
            debugger;
            particle = p;
            break;
        }
    }

    return particle;
}

/* Compute force (as a vector) due to particle configuration (pList) at specified point */
function force(q, x, y, pList = particles){
    var xcomp = 0, ycomp = 0;
    for (var i = 0; i < pList.length; i++){
        var p = pList[i];
        var dsqrd = distanceSqrd(x, y, p.xcoord, p.ycoord);
        // vector from particle i to charge q
        if (dsqrd > 0){ 
            var mag = (k * q * p.charge / dsqrd) * 
                        (meterPerPixel / Math.sqrt(dsqrd)); // 2nd term is for normalization of vec(p,q)
            xcomp += mag * (x - p.xcoord);
            ycomp += mag * (p.ycoord - y); // y coords are inverted on canvas
        }
    }
    return [xcomp, ycomp];
}

function electricfield(x, y){
    return force(1, x, y);
}

/* Compute electic potential due to particle configuration at specified point */
function electricpotential(x, y){
    var V = 0;
    for (var i = 0; i < particles.length; i++){
        var p = particles[i];
        var dsqrd = distanceSqrd(x, y, p.xcoord, p.ycoord);
        // vector from particle i to charge q
        if (dsqrd > 0){ 
            V += k * p.charge / Math.sqrt(dsqrd);
        }
    }
    return V;
}

/* Compute electric potential energy of a system of charged particles */
function electricpotentialenergy(){
    var U = 0;
    for (var i = 0; i < particles.length; i++){
        var p1 = particles[i];
        for (j = i+1; j < particles.length; j++){
            var p2 = particles[j];

            U += k * p2.charge * p1.charge / Math.sqrt(distanceSqrd(p1.xcoord, p1.ycoord, p2.xcoord, p2.ycoord));
        }
    }
    return U;
}
/***** END COMPUTATIONAL FUNCTIONS *****/

/* Handler for menu button */
function OnMenuBtnClick(x) {
    x.classList.toggle("change");
    document.getElementById("myDropdown").classList.toggle("show");
}

/* Handler for animate menu option */
function OnAnimateClick(x) {
    unshow();
    animate = !animate;
    x.textContent = animate ? "Freeze" : "Animate";
    mode = animate ? Actions.freeze : Actions.animate;
    
    redrawInitialParticles();
    if (animate) {
        document.getElementsByClassName("anim-slider")[0].classList.add("show");
        document.getElementsByClassName("animateMenu")[0].classList.add("show");
    }
} 

/* Handler for draw menu option */
function OnDrawClick(x) {
    unshow();
    mode = Actions.draw;

    animate = false;
    document.getElementsByClassName("animateBtn")[0].textContent = "Animate";

    redrawInitialParticles();
    document.getElementsByClassName("drawMenu")[0].classList.add("show");
}

/* Handler for calculate menu option */
function OnCalculateClick(x) {
    unshow();
    mode = Actions.calculate;
    
    animate = false;
    document.getElementsByClassName("animateBtn")[0].textContent = "Animate";

    drawCalcKey();
    document.getElementById("calc-out").classList.add("show");
    document.getElementsByClassName("distanceKey-container")[0].classList.add("show");
    document.getElementsByClassName("calc-slider")[0].classList.add("show");
    document.getElementsByClassName("calculateMenu")[0].classList.add("show");
}

/* Draw a distance key for the canvas */
function drawCalcKey(){
    const w = 100;
    const h = 5;

    var mainCvs = document.getElementById("myCanvas");
    var bBox = mainCvs.getBoundingClientRect();
    // Stretch factor should currently be 1
    var horizStretch = bBox.width/mainCvs.width;
    var vertStretch = bBox.height/mainCvs.height;

    var cvs = document.getElementById("myDistanceKey");
    var ctx = cvs.getContext("2d");
    ctx.clearRect(0, 0, cvs.width, cvs.height);

    var b = cvs.height - 5;
    var r = cvs.width - 5;
    
    ctx.moveTo(r-w, b);
    ctx.lineTo(r, b);
    ctx.stroke();

    ctx.moveTo(r, b);
    ctx.lineTo(r, b-50);
    ctx.stroke();

    ctx.font = "10px Arial";
    var scaledLen = w * meterPerPixel * 1e9 * horizStretch;
    var scaledHeight = 50 * meterPerPixel * 1e9 * vertStretch;

    ctx.fillText((scaledLen).toFixed(1) + " nm", r - w/2 - 15 - Math.log(scaledLen), b-2*h);
    ctx.fillText((scaledHeight).toFixed(1) + " nm", r - 40 - Math.log(scaledHeight), b - 40);
}

function OnCalcSliderChange(newVal){
    document.getElementById("nmPerPixel").value = newVal / 10.;
    meterPerPixel = document.getElementById("nmPerPixel").value * 1e-9;
    drawCalcKey();
}

/* 
    Removes temporary page elements
    MUST be called before mode is updated
*/
function unshow(){
    switch(mode) {
        case Actions.freeze:
        case Actions.animate:
            document.getElementsByClassName("animateMenu")[0].classList.remove("show");
            document.getElementsByClassName("anim-slider")[0].classList.remove("show");
            break;
        case Actions.draw:
            document.getElementsByClassName("drawMenu")[0].classList.remove("show");
            break;
        case Actions.calculate:
            document.getElementById("calc-out").classList.remove("show");
            document.getElementsByClassName("calc-slider")[0].classList.remove("show");
            document.getElementsByClassName("distanceKey-container")[0].classList.remove("show");
            document.getElementsByClassName("calculateMenu")[0].classList.remove("show");
            var txt = document.getElementsByClassName("E-text");
            for (var i = 0; i < txt.length; i++){
                txt[i].classList.remove("show");
            }
            break;
    }
}

/* Update drawType when a new drawing option is selected */
function DrawMenuToggle(x){
    drawType = readRadioList("drawOpt", DrawObj);
}

function CalculateMenuToggle(x){
    computeType = readRadioList("calcOpt", Computation);

    var txt = document.getElementsByClassName("E-text");
    for (var i = 0; i < txt.length; i++){
        txt[i].classList.remove("show");
    }

    switch(computeType){
        case Computation.force:
            document.getElementById("E-force-text").classList.add("show");
            redrawInitialParticles();
            break;
        case Computation.electricpotential:
            document.getElementById("E-potential-text").classList.add("show");
            redrawInitialParticles();
            break;
        case Computation.electricpotentialenergy:
            document.getElementById("E-potential-energy-text").classList.add("show");
            redrawInitialParticles();
            break;
        case Computation.electricfield:
            document.getElementById("E-field-text").classList.add("show");
            drawEField();
            break;
    }
}

/*  
    Iterates through list of radio buttons having name radioName and returns
    the value in vulueEnum corresponding to the selected button. 
*/
function readRadioList(radioName, valueEnum){
    var radios = document.getElementsByName(radioName);
    for( i = 0; i < radios.length; i++ ) {
        if( radios[i].checked ) {
            return valueEnum[radios[i].value];
        }
    }
}

// Hide menu when we click somewhere else on window
window.onclick = function(event) {
    if (!event.target.matches(".mnuBtn") && !event.target.matches("[class^=bar]")){
        document.getElementById("mnuBtn").classList.remove("change");
        document.getElementById("myDropdown").classList.remove("show");
    }
}

window.onload = function(event) {
    var cvs = document.getElementById("myCanvas");
    cvs.width = window.innerWidth;
}