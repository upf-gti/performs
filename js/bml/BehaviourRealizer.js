//@BehaviorRealizer
import * as THREE from 'three';
let DEG2RAD = Math.PI / 180;
let RAD2DEG = 180 / Math.PI;

// --------------------- BLINK ---------------------
// BML
// <blink start attackPeak relax end amount>
function Blink( auto = true ) {
    
    this.start = 0;
    this.end = 0;
    this.elapsedTime = 0;
    this.initWs = [0, 0]; // initial pose of eyelids
    this.endWs = [0, 0]; // target pose of eyelids ( constantly changes during update )
    this.weights = [0, 0]; // current status

    this.state = 0x01; // 0 waiting, 0x01 needs init, 0x02 blinking -- flags
    this.auto = !!auto; // whether to automatically change the state from waiting to init (does not call "update" by itself)
    this.timeoutID = null; // this would not be necessary if timeout was not used
}

Blink.prototype.setAuto = function ( isAutomatic ){ 
    this.auto = !!isAutomatic;
    if ( this.auto && !this.state ){ this.state = 0x01; } // when auto == true, force start if it was stopped
}

Blink.prototype.reset = function (){ 
    if( this.auto ){ this.state = 0x01; }
    else{ this.state = 0x00; }
    if ( this.timeoutID ){ clearTimeout( this.timeoutID ); this.timeoutID = null; }
}

Blink.prototype.initBlinking = function (cw0, cw1) {
    
    if( this.state & 0x02 ){ // forced a blink while already executing one
        this.initWs[0] = this.weights[0]; this.initWs[1] = this.weights[1];
    }else{
        this.initWs[0] = cw0; this.initWs[1] = cw1;
        this.weights[0] = cw0; this.weights[1] = cw1;
    }
    this.endWs[0] = cw0; this.endWs[1] = cw1;
    
    this.elapsedTime = 0;
    this.start = 0;
    let lowestWeight = Math.min(cw0, cw1);
    lowestWeight = Math.min(1, Math.max(0, lowestWeight));
    this.end = 0.5 * (1 - lowestWeight);
    this.end = Math.max(this.end, this.start); // just in case

    this.state = 0x02;
}

Blink.prototype.blink = function () { this.state |= 0x01; }
Blink.prototype._timeoutBlink = function () { if ( this.auto ){ this.state |= 0x01; } this.timeoutID = null; }

Blink.prototype.update = function ( dt, currentWeight0, currentWeight1 ) {

    if ( this.state & 0x01 ) {
        this.initBlinking( currentWeight0, currentWeight1 );
    }
    if ( this.state && dt > 0 ) {
        this.elapsedTime += dt;
        this.endWs[0] = currentWeight0;
        this.endWs[1] = currentWeight1;

        this.computeWeight( this.elapsedTime );

        if (this.elapsedTime > this.end ) { // schedule next blink
            this.state = 0;
            if ( this.auto && !this.timeoutID ){ this.timeoutID = setTimeout( this._timeoutBlink.bind( this ), Math.random() * 3000 + 1500 ); }
            return;
        }
    }
}


//Paper --> Eye Movement Synthesis with 1/ f Pink Noise -- Andrew Duchowski∗, Sophie Jörg, Aubrey Lawson, Takumi Bolte, Lech Swirski  ́

// W(t) = -> a - (t/mu)^2 if t<=mu
//        -> b - e^(-w*log(t-mu+1)) otherwise
// where t = [0,100] normalized percent blink duration 
// mu = 37 when the lid should reach full closure
// a = 0.98 percent lid closure at the start of the blink
// b = 1.18 
// w = mu/100 parameters used to shape the asymptotic lid opening dunction

Blink.prototype.computeWeight = function (dt) {
    
    let t = (dt - this.start) / (this.end - this.start) * 100;
    t = Math.min(100, Math.max(0, t));
    let mu = 37;
    let a = 1;
    let b = 1.18;
    let c = mu / 100;
    let w = 0;
    let srcWs = null;
    if (t <= mu) {
        w = a - Math.pow(t / mu, 2);
        srcWs = this.initWs;
    } else {
        w = b - Math.pow(Math.E, (-c * Math.log2(t - mu + 1)));
        srcWs = this.endWs;
    }
    w = Math.min(1, Math.max(0, w));
    this.weights[0] = 1 - w * (1 - srcWs[0]);
    this.weights[1] = 1 - w * (1 - srcWs[1]);
}


// --------------------- FACIAL EXPRESSIONS ---------------------
// BML
// <face or faceShift start attackPeak relax* end* valaro
// <faceLexeme start attackPeak relax* end* lexeme amount
// <faceFacs not implemented>
// lexeme  [OBLIQUE_BROWS, RAISE_BROWS,
//      RAISE_LEFT_BROW, RAISE_RIGHT_BROW,LOWER_BROWS, LOWER_LEFT_BROW,
//      LOWER_RIGHT_BROW, LOWER_MOUTH_CORNERS,
//      LOWER_LEFT_MOUTH_CORNER,
//      LOWER_RIGHT_MOUTH_CORNER,
//      RAISE_MOUTH_CORNERS,
//      RAISE_RIGHT_MOUTH_CORNER,
//      RAISE_LEFT_MOUTH_CORNER, OPEN_MOUTH,
//      OPEN_LIPS, WIDEN_EYES, CLOSE_EYES]
//


// Static 
// first row = blendshape indices || second row = blendshape proportional amount (some blendshapes are slightly used, others are fully used)
FacialExpr.NMF = {}; // lookup table for lexeme-blendshape relation

// SignON actions units
// BROWS
FacialExpr.NMF.ARCH =                       [[1, 2, 0], [1, 1, 1]];
FacialExpr.NMF.BROW_LOWERER =               [[3, 4], [1,1]]; // AU4 brows down
FacialExpr.NMF.BROW_LOWERER_LEFT =          [[3], [1]]; // LAU4
FacialExpr.NMF.BROW_LOWERER_RIGHT =         [[4], [1]]; // RAU4 
FacialExpr.NMF.BROW_RAISER =                [[1, 2], [1,1]]; //  brow up
FacialExpr.NMF.BROW_RAISER_LEFT =           [[1], [1]]; // left brow up
FacialExpr.NMF.BROW_RAISER_RIGHT =          [[2], [1]]; // right brow up
FacialExpr.NMF.INNER_BROW_RAISER =          [[0], [1]]; // AU1 rows rotate outwards
FacialExpr.NMF.OUTER_BROW_RAISER =          [[1, 2], [1,1]]; // AU2 brows up (right)
// EYES
FacialExpr.NMF.SQUINT =                     [[49, 50], [1, 1]];
FacialExpr.NMF.BLINK =                      [[51, 52], [1, 1]]; // AU45 eyelids closed 
FacialExpr.NMF.EYES_CLOSED =                [[51, 52], [1, 1]]; // AU43 eyelids closed
FacialExpr.NMF.UPPER_LID_RAISER =           [[47, 48], [1,1]]; // AU5 negative eyelids closed /wide eyes
FacialExpr.NMF.UPPER_LID_RAISER_LEFT =      [[47], [1]]; // AU5 negative eyelids closed /wide eyes
FacialExpr.NMF.UPPER_LID_RAISER_RIGHT =     [[48], [1]]; // AU5 negative eyelids closed /wide eyes 
FacialExpr.NMF.LID_TIGHTENER =              [[51, 52, 49, 50], [0.2, 0.2, 0.8, 0.8]]; // AU7 or AU44 squint TODO NEW MAPPING: SQUINT + BLINK
FacialExpr.NMF.WINK_LEFT =                  [[53], [1]]; // AU46
FacialExpr.NMF.WINK_RIGHT =                 [[54], [1]]; // AU46
// CHEEKS
FacialExpr.NMF.CHEEK_RAISER =               [[41, 42], [1,1]]; // AU6 squint 
FacialExpr.NMF.CHEEK_SUCK =                 [[45, 46], [1, 1]]; // AU35
FacialExpr.NMF.CHEEK_SUCK_LEFT =            [[45], [1]]; // LAU35
FacialExpr.NMF.CHEEK_SUCK_RIGHT =           [[46], [1]]; // RAU35
FacialExpr.NMF.CHEEK_BLOW =                 [[43, 44], [1, 1]]; // AU33
FacialExpr.NMF.CHEEK_BLOW_LEFT =            [[43], [1]]; // LAU33
FacialExpr.NMF.CHEEK_BLOW_RIGHT =           [[44], [1]]; // RAU33
// NOSE
FacialExpr.NMF.NOSE_WRINKLER =              [[5, 6], [1, 1]]; // AU9
FacialExpr.NMF.NOSTRIL_DILATOR =            [[7], [1]];       // AU38 - nostril dilator
FacialExpr.NMF.NOSTRIL_COMPRESSOR =         [[8], [1]];       // AU39 - nostril compressor
// LIPS
FacialExpr.NMF.LIP_CORNER_DEPRESSOR =       [[15, 16], [1,1]]; // AU15 sad 
FacialExpr.NMF.LIP_CORNER_DEPRESSOR_LEFT =  [[15], [1]]; // LAU15 sad
FacialExpr.NMF.LIP_CORNER_DEPRESSOR_RIGHT = [[16], [1]]; // RAU15 sad
FacialExpr.NMF.LIP_CORNER_PULLER =          [[13, 14], [1,1]]; // AU12 happy
FacialExpr.NMF.LIP_CORNER_PULLER_LEFT =     [[13], [1]]; // LAU12 happy
FacialExpr.NMF.LIP_CORNER_PULLER_RIGHT =    [[14], [1]]; // RAU12 happy
FacialExpr.NMF.LIP_STRETCHER =               [[21, 22], [1,1]];// AU20
FacialExpr.NMF.LIP_FUNNELER =               [[23], [1]];     // AU22
FacialExpr.NMF.LIP_TIGHTENER =              [[19, 20, 24, 25], [1, 1, 0.3, 0.3]];     // AU23 TODO: PUCKERER + PRESSOR
FacialExpr.NMF.LIP_PUCKERER =               [[19, 20], [1,1]]; // AU18 mouth narrow
FacialExpr.NMF.LIP_PUCKERER_LEFT =          [[19], [1]]; // AU18L mouth narrow left
FacialExpr.NMF.LIP_PUCKERER_RIGHT =         [[20], [1]]; // AU18R mouth narrow right
FacialExpr.NMF.LIP_PRESSOR =                [[24, 25], [1,1]]; // AU24
FacialExpr.NMF.LIPS_PART =                  [[26], [1.0]]; //AU25
FacialExpr.NMF.LIP_SUCK =                   [[27, 28], [1,1]];// AU28
FacialExpr.NMF.LIP_SUCK_UPPER =             [[27], [1]];// AU28U upper lip in
FacialExpr.NMF.LIP_SUCK_LOWER =             [[28], [1]];// AU28D lower lip in 
FacialExpr.NMF.LOWER_LIP_DEPRESSOR =        [[17, 18], [1,1]]; // AU16
FacialExpr.NMF.LOWER_LIP_DEPRESSOR_LEFT =   [[17], [1]]; // LAU16
FacialExpr.NMF.LOWER_LIP_DEPRESSOR_RIGHT =  [[18], [1]]; // RAU16
FacialExpr.NMF.UPPER_LIP_RAISER =           [[11, 12], [1,1]]; // AU10
FacialExpr.NMF.UPPER_LIP_RAISER_LEFT =      [[11], [1]]; // AU10L
FacialExpr.NMF.UPPER_LIP_RAISER_RIGHT =     [[12], [1]]; // AU10R
FacialExpr.NMF.CHIN_RAISER =                [[40], [1]]; // AU17 mouth up
FacialExpr.NMF.DIMPLER =                    [[9, 10], [1, 1]]; // AU14
FacialExpr.NMF.DIMPLER_LEFT =               [[9], [1]]; // LAU14
FacialExpr.NMF.DIMPLER_RIGHT =              [[10], [1]]; // RAU14
FacialExpr.NMF.LIP_BITE =                   [[28, 35, 36], [1, 0.1, 0.05]]; // AU32
// MOUTH-JAW
FacialExpr.NMF.SMILE_TEETH =                [[13, 14, 35], [0.5, 0.5, 0.2]];
FacialExpr.NMF.SMILE_TEETH_WIDE =           [[13, 14, 35], [1, 1, 0.2]];
FacialExpr.NMF.SMILE_CLOSED =               [[13, 14], [1, 1]]; // same as LIP_CORNER_DEPRESSOR
FacialExpr.NMF.ROUND_OPEN =                 [[19, 20, 35], [0.7, 0.7, 0.7]];
FacialExpr.NMF.ROUND_CLOSED =               [[19, 20], [1, 1]]; // same as LIP_PUCKERER
FacialExpr.NMF.MOUTH_STRETCH =              [[35], [1]]; // AU27
FacialExpr.NMF.CLOSE_TIGHT =                [[28, 19, 20, 27], [1, 1, 1, 1]];
FacialExpr.NMF.JAW_DROP =                   [[36], [1]]; // AU26
FacialExpr.NMF.JAW_THRUST =                 [[37], [1]]; // AU29
FacialExpr.NMF.JAW_SIDEWAYS_LEFT =          [[38], [1]]; // AU30L
FacialExpr.NMF.JAW_SIDEWAYS_RIGHT =         [[39], [1]]; // AU30R
// TONGUE
FacialExpr.NMF.TONGUE_BULGE_LEFT =          [[32], [1]];       // LAU36
FacialExpr.NMF.TONGUE_BULGE_RIGHT =         [[33], [1]];       // RAU36
FacialExpr.NMF.TONGUE_UP =                  [[30], [1]];       // 
FacialExpr.NMF.TONGUE_SHOW =                [[31], [1]];       // AU19
FacialExpr.NMF.TONGUE_WIDE =                [[34], [1]];       // 
FacialExpr.NMF.LIP_WIPE =                   [[29], [1]];       // AU37
// NECK
FacialExpr.NMF.NECK_TIGHTENER =             [[55], [1]];       // AU21


// Constructor
function FacialExpr(faceData, shift) {
    
    this.transition = false;

    let lexemes = faceData.lexeme;

    // Init face lexemes 
    if ( !lexemes ) { return; }

    // faceLexeme
    if ( typeof (lexemes) == "string" ){ this.initFaceLexeme(faceData, shift, [faceData]); }
    else if( Array.isArray( lexemes ) ){ this.initFaceLexeme(faceData, shift, lexemes); } // Several lexemes inside face/faceShift (faceData.lexeme = [{}, {}]...)
    else if ( typeof( lexemes ) == "object" ){ this.initFaceLexeme(faceData, shift, [lexemes]); } // One lexeme object inside face/faceShift (faceData.lexeme = {lexeme:"RAISE_BROWS"; amount: 0.1})

}

// There can be several facelexemes working at the same time then? lexemes is an array of lexeme objects
FacialExpr.prototype.initFaceLexeme = function (faceData, shift, lexemes) {

    // Sync
    this.start = faceData.start || 0.0;
    this.end = faceData.end;

    if (!shift) {
        this.attackPeak = faceData.attackPeak || (this.end - this.start) * 0.25 + this.start;
        this.relax = faceData.relax || (this.end - this.attackPeak) / 2 + this.attackPeak;
    } else {
        this.end = faceData.end || faceData.attackPeak || 0.0;
        this.attackPeak = faceData.attackPeak || this.end;
        this.relax = 0;
    }

    // Initial blend shapes and targets
    // Choose the ones to interpolate
    this.indicesLex = [];
    this.targetLexBSW = [];
    this.currentLexBSW = [];

    let j = 0; // index of accepted lexemes
    for (let i = 0; i < lexemes.length; i++) {

        let lexemeStr = lexemes[i].lexeme;
        if (typeof (lexemeStr) !== "string") { lexemeStr = "NO_LEXEME"; }
        else{ lexemeStr = lexemeStr.toUpperCase(); }

        // does lexeme exist?
        if ( !FacialExpr.NMF[lexemeStr] ) {
            this.transition = false;
            this.time = this.end;
            console.warn("Facial lexeme not found:", lexemeStr, ". Please refer to the standard.");
            continue;
        }

        // FacialExpr.NMF[lexemeStr] returns array [ BlendshapeIndices, weights ]
        let indices = FacialExpr.NMF[lexemeStr][0]; // get only the blendshape indices
        let weights = FacialExpr.NMF[lexemeStr][1]; // get only the blendshape weights

        // Indices
        this.indicesLex[j] = indices;
        this.targetLexBSW[j] = [];
        this.currentLexBSW[j] = [];

        // ensure lexeme has an intensity
        let lexemeAmount = lexemes[i].amount;
        lexemeAmount = (isNaN(lexemeAmount) || lexemeAmount == null ) ? faceData.amount : lexemeAmount;
        lexemeAmount = (isNaN(lexemeAmount) || lexemeAmount == null ) ? 1 : lexemeAmount;

        // set initial and target blendshape values for this lexeme
        for (let e = 0; e < indices.length; ++e) {
            this.targetLexBSW[j][e] = lexemeAmount * weights[e];
            this.currentLexBSW[j][e] = 0;
        }

        j++;
    }

    // Start
    this.transition = true;
    this.time = 0;
}

FacialExpr.prototype.updateLexemesBSW = function (dt) {

    // Immediate change
    if (this.attackPeak == 0 && this.end == 0 && this.time == 0) {
        for (var i = 0; i < this.indicesLex.length; i++)
            for (var j = 0; j < this.indicesLex[i].length; j++)
                this.currentLexBSW[i][j] = this.targetLexBSW[i][j];

        // Increase time and exit
        this.time += dt;
        return;
    }

    // Time increase
    this.time += dt;

    // Wait for to reach start time
    if (this.time < this.start) { return; }

    let inter = 0;

    if (this.time < this.start) {
        // did not even start
        inter = 0;
    } else if (this.time < this.attackPeak) {
        // Trans 1 - intro
        inter = (this.time - this.start) / (this.attackPeak - this.start);
        inter = Math.cos(Math.PI * inter + Math.PI) * 0.5 + 0.5;
    } else if (this.time < this.relax) {
        // Stay still from attackPeak to relax
        inter = 1;
    } else if (this.time < this.end) {
        // Trans 2 - outro
        inter = (this.time - this.relax) / (this.end - this.relax);
        inter = 1 - inter; // outro goes from target to 0
        inter = Math.cos(Math.PI * inter + Math.PI) * 0.5 + 0.5;
    } else {
        // end
        inter = 0;
        this.transition = false;
    }

    // Interpolation
    for (var i = 0; i < this.indicesLex.length; i++) {
        for (var j = 0; j < this.indicesLex[i].length; j++) {
            this.currentLexBSW[i][j] = inter * this.targetLexBSW[i][j];
        }
    }
}


// ---------------------------------------- FacialEmotion ----------------------------------

// Variables for Valence Arousal

// Psyche Interpolation Table
/*FacialExpr.prototype._emotionsVAE = [0.000, 0.000,  0.000,  0.000,  0.000,  0.000,  0.000,  0.000,  0.000,  0.000,  0.000,
                            0.000,  1.000,  0.138,  1.00,  0.000,  0.675,  0.000,  0.056,  0.200,  0.116,  0.100,
                            0.500,  0.866,  0.000,  0.700,  0.000,  0.000,  0.000,  0.530,  0.000,  0.763,  0.000,
                            0.866,  0.500,  0.000,  1.000,  0.000,  0.000,  0.600,  0.346,  0.732,  0.779,  0.000,
                            1.000,  0.000,  0.065,  0.000,  0.344,  0.344,  0.700,  0.000,  0.000,  1.000,  -0.300,
                            0.866,  -0.500, 0.391,  0.570,  0.591,  0.462,  1.000,  0.000,  0.981,  0.077,  0.000,
                            0.500,  -0.866, 0.920,  0.527,  0.000,  0.757,  0.250,  0.989,  0.000,  0.366,  -0.600,
                            0.000,  -1.000, 0.527,  0.000,  0.441,  0.531,  0.000,  0.000,  1.000,  0.000,  0.600,
                            -0.707, -0.707, 1.000,  0.000,  0.000,  0.000,  0.500,  1.000,  0.000,  0.000,  0.600,
                            -1.000, 0.000,  0.995,  0.000,  0.225,  0.000,  0.000,  0.996,  0.000,  0.996,  0.200,
                            -0.707, 0.707,  0.138,  0.075,  0.000,  0.675,  0.300,  0.380,  0.050,  0.216,  0.300];*/

/* "valence", "arousal" ,"BLINK","CHEEK_RAISER", "LIP_CORNER_PULLER", "BROW_LOWERER", "DIMPLER", "OUTER_BROW_RAISER", "
UPPER_LID_RAISER", "JAW_DROP","LID_TIGHTENER", "LIP_STRETCHER","NOSE_WRINKLER", "LIP_CORNER_DEPRESSOR", "CHIN_RAISER", "LIP_CORNER_PULLER_RIGHT", "DIMPLER_RIGHT"*/
/*FacialExpr.prototype._emotionsVAE = [
  [0.95, 0.23 ,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0 ],//HAPPINESS
  [-0.81, -0.57, 0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0 ], //SADNESS
  [0.22, 0.98, 0,0,0,1,0,1,1,1,0,0,0,0,0,0,0,0 ], //SURPRISED
  [-0.25, 0.98 ,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0 ], //FEAR
  [-0.76, 0.64,0 , 0,0,0,1,0,1,0,1,0,1,0,0,0,0,0 ], //ANGER
  [-0.96, 0.23,0, 0,0,0,0,0,0,0,0,0,0,1,1,1,0,0 ], //DISGUST
  [-0.98, -0.21,0, 0,0,0,0,0,0,0,0,0,0,0,0,0,1,1 ], //CONTEMPT
  [0, 0 ,0, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0 ] //NEUTRAL
  ]*/

// VAE - Valence, Arousal, Expression(s)
FacialEmotion.prototype._emotionsVAE = [
    [//ANGRY
        -0.76, 0.64,
        [FacialExpr.NMF.BROW_LOWERER, 0.9],
        [FacialExpr.NMF.UPPER_LID_RAISER, 0.1],
        [FacialExpr.NMF.LID_TIGHTENER, 0.25],
        [FacialExpr.NMF.LIP_CORNER_DEPRESSOR, 0.3],
        [FacialExpr.NMF.NOSE_WRINKLER, 0.2]
    ],
    [//HAPPY
        0.95, 0.23,
        [FacialExpr.NMF.CHEEK_RAISER, 0.4],
        [FacialExpr.NMF.BROW_RAISER, 0.1],
        [FacialExpr.NMF.SMILE_CLOSED, 0.75]
    ],
    [//SAD
        -0.81, -0.57,
        [FacialExpr.NMF.INNER_BROW_RAISER, 0.8],
        [FacialExpr.NMF.BROW_LOWERER, 0.5],
        [FacialExpr.NMF.LIP_CORNER_DEPRESSOR, 0.5],
    ],
    [//SURPRISED
        0.22, 0.98,
        [FacialExpr.NMF.INNER_BROW_RAISER, 0.5],
        [FacialExpr.NMF.OUTER_BROW_RAISER, 0.5],
        [FacialExpr.NMF.UPPER_LID_RAISER, 0.3],
        [FacialExpr.NMF.LIP_PUCKERER, 0.3],
        [FacialExpr.NMF.JAW_DROP, 0.35],
        [FacialExpr.NMF.MOUTH_STRETCH, 0.1]
    ],
    [//SACRED
        -0.25, 0.98,
        [FacialExpr.NMF.INNER_BROW_RAISER, 1.0],
        [FacialExpr.NMF.BROW_LOWERER, 0.5],
        [FacialExpr.NMF.UPPER_LID_RAISER, 0.3],
        [FacialExpr.NMF.LIP_STRETCHER, 0.3],
        [FacialExpr.NMF.JAW_DROP, 0.3]
    ],
    [//DISGUSTED
        -0.96, 0.23,
        [FacialExpr.NMF.NOSE_WRINKLER, 0.35],
        [FacialExpr.NMF.BROW_LOWERER, 0.35],
        [FacialExpr.NMF.SQUINT, 0.5],
        [FacialExpr.NMF.LIP_CORNER_DEPRESSOR, 0.2],
        [FacialExpr.NMF.UPPER_LIP_RAISER, 0.3],
        [FacialExpr.NMF.LOWER_LIP_DEPRESSOR, 0.1]
    ],
    [//CONTEMPT
        -0.98, -0.21,
        [FacialExpr.NMF.LIP_CORNER_PULLER_LEFT, 0.7],
        [FacialExpr.NMF.DIMPLER_LEFT, 0.5]
    ],
    [
        0,0
    ]
]

function FacialEmotion(sceneBSW) {
    
    // The aim of this class is to contain the current emotion of the avatar. It is intended to be reused
    this.gridSize = 100; // 100 x 100
    this.precomputeVAWeights(this.gridSize); // this could be done as a static...

    this.transition = false;
    this.time = 0;

    this.sceneBSW = sceneBSW;

    // generate arrays for current, init and target. Current and init will be constantly swapped on initFaceVAlaro
    this.initialVABSW = [];
    this.targetVABSW = [];
    this.currentVABSW = [];
    if (sceneBSW) {
        this.currentVABSW = this.sceneBSW.slice();
    }
    else {
        this.currentVABSW = this._emotionsVAE[0].slice(2); // first two elements of emotions are valence and arousal
    }
    this.currentVABSW.fill(0);
    this.initialVABSW = this.currentVABSW.slice();
    this.targetVABSW = this.currentVABSW.slice();
    this.defaultVABSW = this.currentVABSW.slice();
}

FacialEmotion.prototype.reset = function () {
    
    this.currentVABSW.fill(0);
    this.initialVABSW.fill(0);
    this.targetVABSW.fill(0);
    this.defaultVABSW.fill(0);
    this.transition = false;
    this.time = 0;
}

FacialEmotion.prototype.precomputeVAWeights = function (gridsize = 100) {
    
    // generates a grid of gridSize size, where for each point it determines which emotion is closer and its distance

    // each emotion's valaro as point
    let valAroPoints = [];
    for (let count = 0; count < this._emotionsVAE.length; count++) {
        let point = new THREE.Vector2(this._emotionsVAE[count][0], this._emotionsVAE[count][1]); 
        valAroPoints.push(point);
    }
    let num_points = valAroPoints.length;
    let pos = new THREE.Vector2();

    // create grid
    let total_nums = 2 * gridsize * gridsize;
    this._precomputed_weights = new Float32Array(total_nums);
    let values = this._precomputed_weights;
    this._precomputed_weights_gridsize = gridsize;

    // for each point in grid
    for (var y = 0; y < gridsize; ++y)
        for (var x = 0; x < gridsize; ++x) {
            let nearest = -1;
            let min_dist = 100000;
            //normalize
            pos.x = x / gridsize;
            pos.y = y / gridsize;
            // center coords
            pos.x = pos.x * 2 - 1;
            pos.y = pos.y * 2 - 1;

            // which emotion is closer to this point and its distance
            for (var i = 0; i < num_points; ++i) {
                let dist = pos.distanceToSquared(valAroPoints[i]); 
                if (dist > min_dist)
                    continue;
                nearest = i;
                min_dist = dist;
            }

            values[2 * (x + y * gridsize)] = nearest;
            values[2 * (x + y * gridsize) + 1] = min_dist;
        }

    return values;
}

FacialEmotion.prototype.initFaceValAro = function (faceData, shift) {

    // Valence and arousal
    //let valaro = faceData.valaro || [0.1, 0.1];
    this.valaro = new THREE.Vector2().fromArray(faceData.valaro || [0.1, 0.1]);
    if (faceData.emotion) {
        switch (faceData.emotion) {
            case "ANGER":
                this.valaro.fromArray(this._emotionsVAE[0].slice(0, 2));
                break;
            case "HAPPINESS":
                this.valaro.fromArray(this._emotionsVAE[1].slice(0, 2));
                break;
            case "SADNESS":
                this.valaro.fromArray(this._emotionsVAE[2].slice(0, 2));
                break;
            case "SURPRISE":
                this.valaro.fromArray(this._emotionsVAE[3].slice(0, 2));
                break;
            case "FEAR":
                this.valaro.fromArray(this._emotionsVAE[4].slice(0, 2));
                break;
            case "DISGUST":
                this.valaro.fromArray(this._emotionsVAE[5].slice(0, 2));
                break;
            case "CONTEMPT":
                this.valaro.fromArray(this._emotionsVAE[6].slice(0, 2));
                break;
            default: // "NEUTRAL"
                this.valaro.fromArray(this._emotionsVAE[7].slice(0, 2));
                break;
        }
    }

    // Normalize
    let magn = this.valaro.length();
    if ( magn > 1 ) {
        this.valaro.x /= magn;
        this.valaro.y /= magn;
    }

    // Sync
    this.start = faceData.start || 0.0;
    this.end = faceData.end;
    this.amount = faceData.amount || 1.0;
    if ( shift ) {
        this.attackPeak = faceData.attackPeak || this.end;
        this.relax = this.end = this.attackPeak + 1;//faceData.end || faceData.attackPeak || 0.0; // ignored "end" and "relax" on shift
    } else {
        this.attackPeak = faceData.attackPeak || (this.end - this.start) * 0.25 + this.start;
        this.relax = faceData.relax || (this.end - this.attackPeak) / 2 + this.attackPeak;
    }
    this.amount = isNaN(faceData.amount) ? 1 : faceData.amount;

    // Target blend shapes
    this.VA2BSW(this.valaro, shift);

    // Start
    this.transition = true;
    this.time = 0;
}

FacialEmotion.prototype.VA2BSW = function (valAro, shift) {

    let gridsize = this.gridSize;
    let blendValues = this.currentVABSW.slice();
    // blendValues.length = this._emotionsVAE[0].length - 2;
    blendValues.fill(0);

    // position in grid to check
    let pos = valAro.clone();

    //precompute VA points weight in the grid
    let values = this._precomputed_weights;

    // one entry for each emotion
    let weights = [];
    weights.length = this._emotionsVAE.length;
    weights.fill(0);

    let total_inside = 0;
    let pos2 = new THREE.Vector2(); 
    //for each position in grid, check if distance to pos is lower than distance to its nearest emotion
    for (let y = 0; y < gridsize; ++y) {
        for (let x = 0; x < gridsize; ++x) {
            //normalize
            pos2.x = x / gridsize;
            pos2.y = y / gridsize;
            //center
            pos2.x = pos2.x * 2 - 1;
            pos2.y = pos2.y * 2 - 1;

            let data_pos = (x + y * gridsize) * 2; // two values in each entry
            let point_index = values[data_pos];
            let point_distance = values[data_pos + 1];
            let is_inside = pos2.distanceToSquared(pos) < (point_distance + 0.001);//epsilon
            if (is_inside) {
                weights[point_index] += 1;
                total_inside++;
            }
        }
    }

    // average each emotion with respect to amount of points near this.valAro
    for (let i = 0; i < weights.length; ++i) {
        weights[i] /= total_inside;
        let emotion = this._emotionsVAE[i]; // [ val, aro, [FacialExpr.NMF.BROW_LOWERER, 0.5],[FacialExpr.NMF.BROW_LOWERER, 0.5],[FacialExpr.NMF.BROW_LOWERER, 0.5], .. ]
        for( let j = 2; j < emotion.length; j++ ){ 
            // [FacialExpr.NMF.BROW_LOWERER, 0.5]
            let expression = emotion[j][0]; // FacialExpr.NMF.BROW_LOWERER == [ [1,2], [1,1] ]
            let exprAmount = emotion[j][1];
            for( let k = 0; k < expression[0].length; k++ ){ // [1,2]
                blendValues[ expression[0][k] ] += expression[1][k] * exprAmount * weights[i]; 
            }
        }
    }

    // swap initial state and current state arrays
    for (let j = 0; j < blendValues.length; j++) {
        this.targetVABSW[j] = blendValues[j] * this.amount;
        this.initialVABSW[j] = this.currentVABSW[j]; // initial and current should be the same
        if ( shift ){ // change default pose if shift
            this.defaultVABSW[j] = this.targetVABSW[j]; 
        }
    }
}

FacialEmotion.prototype.updateVABSW = function (dt) {
    if( this.transition == false ){
        for (let j = 0; j < this.currentVABSW.length; j++)
            this.currentVABSW[j] = this.defaultVABSW[j];
        return;
    }
    
    // Time increase
    this.time += dt;

    // Wait for to reach start time
    if (this.time < this.start){
        return;
    }

    // Stay still during attackPeak to relax
    if (this.time > this.attackPeak && this.time < this.relax){
        return;
    }

    // End
    if (this.time >= this.end) {
        for (let j = 0; j < this.currentVABSW.length; j++)
            this.currentVABSW[j] = this.defaultVABSW[j];
        this.transition = false;
        return;
    }

    let inter = 0;
    // Trans 1
    if (this.time <= this.attackPeak) {
        inter = (this.time - this.start) / (this.attackPeak - this.start);
        // Cosine interpolation
        inter = Math.cos(Math.PI * inter + Math.PI) * 0.5 + 0.5;
        // Interpolation
        for (let j = 0; j < this.targetVABSW.length; j++)
            this.currentVABSW[j] = this.initialVABSW[j] * (1 - inter) + this.targetVABSW[j] * inter;
        return;
    }

    // Trans 2
    if (this.time > this.relax && this.time < this.end) {
        inter = (this.time - this.relax) / (this.end - this.relax);
        // Cosine interpolation
        inter = Math.cos(Math.PI * inter) * 0.5 + 0.5;
        // Interpolation
        for (let j = 0; j < this.targetVABSW.length; j++)
           this.currentVABSW[j] = this.defaultVABSW[j] * (1 - inter) + this.targetVABSW[j] * inter;
        return;
    }
}


// --------------------- GAZE (AND HEAD SHIFT DIRECTION) ---------------------
// BML
// <gaze or gazeShift start ready* relax* end influence target offsetAngle offsetDirection>
// influence [EYES, HEAD, NECK, SHOULDER, WAIST, WHOLE, ...]
// offsetAngle relative to target
// offsetDirection (of offsetAngle) [RIGHT, LEFT, UP, DOWN, UP_RIGHT, UP_LEFT, DOWN_LEFT, DOWN_RIGHT]
// target [CAMERA, RIGHT, LEFT, UP, DOWN, UP_RIGHT, UP_LEFT, DOWN_LEFT, DOWN_RIGHT]
// Scene inputs: gazePositions (head and camera), lookAt objects

// Gaze manager (replace BML)
GazeManager.gazePositions = {   
    "RIGHT": new THREE.Vector3(-30, 2, 100), "LEFT": new THREE.Vector3(30, 2, 100),
    "UP": new THREE.Vector3(0, 20, 100), "DOWN": new THREE.Vector3(0, -20, 100),
    "UP_RIGHT": new THREE.Vector3(-30, 20, 100), "UP_LEFT": new THREE.Vector3(30, 20, 100),
    "DOWN_RIGHT": new THREE.Vector3(-30, -20, 100), "DOWN_LEFT": new THREE.Vector3(30, -20, 100),
    "FRONT": new THREE.Vector3(0, 2, 100), "CAMERA": new THREE.Vector3(0, 2, 100)
};

Gaze.prototype.gazeBS = {
    "RIGHT": { squint: 0, eyelids: 0 }, "LEFT": { squint: 0, eyelids: 0 },
    "UP": { squint: 0.3, eyelids: 0 }, "DOWN": { squint: 0, eyelids: 0.2 },
    "UP_RIGHT": { squint: 0.3, eyelids: 0 }, "UP_LEFT": { squint: 0.3, eyelids: 0 },
    "DOWN_RIGHT": { squint: 0, eyelids: 0.2 }, "DOWN_LEFT": { squint: 0, eyelids: 0.2 },
    "FRONT": { squint: 0, eyelids: 0 }, "CAMERA": { squint: 0, eyelids: 0 }, 
    "EYES_TARGET": { squint: 0, eyelids: 0 }, "HEAD_TARGET": { squint: 0, eyelids: 0 }, "NECK_TARGET": { squint: 0, eyelids: 0 }
};

// Constructor (lookAt objects and gazePositions)
function GazeManager(lookAtNeck, lookAtHead, lookAtEyes, gazePositions = null) {
    
    // Gaze positions
    this.gazePositions = gazePositions || GazeManager.gazePositions;

    // LookAt objects
    this.lookAtNeck = lookAtNeck;
    this.lookAtHead = lookAtHead;
    this.lookAtEyes = lookAtEyes;

    // Gaze Actions (could create here inital gazes and then recycle for memory efficiency)
    this.gazeActions = [null, null, null]; // eyes, head, neck
    this.gazeActions[0] = new Gaze(this.lookAtEyes, this.gazePositions, true);
    this.gazeActions[1] = new Gaze(this.lookAtHead, this.gazePositions, false);
    this.gazeActions[2] = new Gaze(this.lookAtNeck, this.gazePositions, false);
}

GazeManager.prototype.reset = function () {

    this.lookAtNeck.position.set(0, 2.5, 100);
    this.lookAtHead.position.set(0, 2.5, 100);
    this.lookAtEyes.position.set(0, 2.5, 100);

    this.gazeActions[0].transition = false;
    this.gazeActions[1].transition = false;
    this.gazeActions[2].transition = false;

    this.gazeActions[0].eyelidsW = 0;
    this.gazeActions[0].squintW = 0;
}

// gazeData with influence, sync attr, target, offsets...
GazeManager.prototype.newGaze = function (gazeData, shift, gazePositions, headOnly) {

    // Gaze positions
    this.gazePositions = gazePositions || this.gazePositions;

    // Influence check, to upper case
    gazeData.influence = stringToUpperCase(gazeData.influence, "Gaze influence", "HEAD");


    // NECK requires adjustment of HEAD and EYES
    // HEAD requires adjustment of EYES
    switch (gazeData.influence) {
        case "NECK":
            this.gazeActions[2].initGazeData(gazeData, shift);
        case "HEAD":
            this.gazeActions[1].initGazeData(gazeData, shift);
        case "EYES":
            if (!headOnly)
                this.gazeActions[0].initGazeData(gazeData, shift);
        default: break;
    }
}

GazeManager.prototype.update = function (dt) {

    // Gaze actions update
    for (let i = 0; i < this.gazeActions.length; i++) {
        // If gaze exists (could inizialize empty gazes)
        if (this.gazeActions[i] && this.gazeActions[i].transition) {
            this.gazeActions[i].update(dt);
        }
    }

    return {
        eyelids: this.gazeActions[0].eyelidsW,
        squint: this.gazeActions[0].squintW
    };
}


// --------------------- GAZE (AND HEAD SHIFT DIRECTION) ---------------------

// Memory allocation of temporal arrays. Used only for some computations in initGazeValues
Gaze.prototype._tempQ = new THREE.Quaternion();
Gaze.prototype.targetP = new THREE.Vector3();

// Constructor
function Gaze(lookAt, gazePositions, isEyes = false) {

    this.isEyes = isEyes;

    // Gaze positions
    if (gazePositions) {
        this.gazePositions = gazePositions;
    }

    // Scene variables
    this.cameraEye = gazePositions["CAMERA"] || new THREE.Vector3();
    this.headPos = gazePositions["HEAD"] || new THREE.Vector3();
    this.lookAt = lookAt;

    // make it deactivated
    this.transition = false;
    this.eyelidsW = 0;
    this.squintW = 0;

    // Define initial and end positions
    this.InP = null; 
    this.EndP = null;
    this.DefP = gazePositions["FRONT"].clone();
}

Gaze.prototype.initGazeData = function (gazeData, shift) {

    // Sync
    this.start = gazeData.start || 0.0;
    this.end = gazeData.end || 2.0;
    if (!shift) {
        this.ready = gazeData.ready || this.start + (this.end - this.start) / 3;
        this.relax = gazeData.relax || this.start + 2 * (this.end - this.start) / 3;
    } else {
        this.ready = this.end;
        this.relax = 0;
    }

    // Offset direction
    this.offsetDirection = stringToUpperCase(gazeData.offsetDirection, "Gaze offsetDirection", "RIGHT");

    // Target
    this.target = stringToUpperCase(gazeData.target, "Gaze target", "FRONT");

    // Angle
    this.offsetAngle = gazeData.offsetAngle || 0.0;

    // Start
    this.transition = true;
    this.time = 0;

    // Extension - Dynamic
    this.dynamic = gazeData.dynamic || false;

    //Blendshapes
    this.eyelidsW = 0;
    this.eyelidsInitW = 0;
    this.eyelidsFinW = gazeData.eyelidsWeight || this.gazeBS[this.target].eyelids;
    this.squintW = gazeData.squintWeight || 0;
    this.squintInitW = gazeData.squintWeight || 0;
    this.squintFinW = gazeData.squintWeight || this.gazeBS[this.target].squint;

    // Define initial values
    this.initGazeValues();
    if ( shift ){ this.DefP = this.EndP.clone(); }

}


Gaze.prototype.update = function (dt) {

    if ( !this.transition )
        return;
    
    // Time increase
    this.time += dt;

    // Wait for to reach start time
    if (this.time < this.start)
        return;

    // Stay still during ready to relax
    if (this.time > this.ready && this.time < this.relax)
        return;

    // Extension - Dynamic (offsets do not work here)
    if (this.dynamic) {
        this.EndP.copy(this.gazePositions[this.target]);
    }

    if ( this.time <= this.ready ){ 
        let inter = (this.time - this.start) / (this.ready - this.start); 
        inter = Math.sin(Math.PI * inter - Math.PI * 0.5) * 0.5 + 0.5;
        if (this.isEyes) {
            this.eyelidsW = this.eyelidsInitW * (1 - inter) + this.eyelidsFinW * (inter);
            this.squintW = this.squintInitW * (1 - inter) + this.squintFinW * (inter);
        }
        // lookAt pos change
        this.lookAt.position.lerpVectors(this.InP, this.EndP, inter);
        return;
    } 
    
    if ( this.time <= this.end ){
        let inter = (this.time - this.relax) / (this.end - this.relax);
        inter = Math.sin(Math.PI * inter - Math.PI * 0.5) * 0.5 + 0.5;
        if (this.isEyes) {
            this.eyelidsW = this.eyelidsFinW * (1 - inter) + this.eyelidsInitW * (inter);
            this.squintW = this.squintFinW * (1 - inter) + this.squintInitW * (inter);
        }
        // lookAt pos change
        this.lookAt.position.lerpVectors(this.EndP, this.DefP, inter);
        return;
    }

    // End
    if (this.time > this.end) {
        // Extension - Dynamic
        if (this.dynamic) {
            this.lookAt.position.copy(this.DefP);
        }
        else {
            this.transition = false;
            this.lookAt.position.copy(this.DefP);
            this.eyelidsW = this.eyelidsInitW;
            this.squintW = this.squintInitW;
        }
    }
}

Gaze.prototype.initGazeValues = function () {

    // Find target position (copy? for following object? if following object and offsetangle, need to recalculate all the time!)
    if (this.gazePositions && this.gazePositions[this.target]) {
        this.targetP.copy(this.gazePositions[this.target]);
    } else {
        this.targetP.set(0, 110, 100);
    }

    // Angle offset
    // Define offset angles (respective to head position?)
    // Move to origin
    let q = this._tempQ;
    let v = this.targetP.sub(this.headPos);
    let magn = v.length();
    v.normalize();
    this.eyelidsFinW = this.gazeBS[this.target].eyelids;
    this.squintFinW = this.gazeBS[this.target].squint;
    // Rotate vector and reposition
    switch (this.offsetDirection) {
        case "UP_RIGHT":
            q.setFromAxisAngle(v, -25 * DEG2RAD);
            v.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.offsetAngle * DEG2RAD);
            v.applyQuaternion(q);

            if (this.isEyes) {
                this.squintFinW *= Math.abs(this.offsetAngle / 30)
            }
            break;

        case "UP_LEFT":
            q.setFromAxisAngle(v, -75 * DEG2RAD);
            v.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.offsetAngle * DEG2RAD);
            v.applyQuaternion(q);
            if (this.isEyes) {

                this.squintFinW *= Math.abs(this.offsetAngle / 30)
            }
            break;

        case "DOWN_RIGHT":
            q.setFromAxisAngle(v, -25 * DEG2RAD);
            v.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.offsetAngle * DEG2RAD);
            v.applyQuaternion(q);
            if (this.isEyes) {
                this.eyelidsFinW *= Math.abs(this.offsetAngle / 30)
            }
            break;

        case "DOWN_LEFT":
            q.setFromAxisAngle(v, 75 * DEG2RAD);
            v.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.offsetAngle * DEG2RAD);
            v.applyQuaternion(q);
            if (this.isEyes) {
                this.eyelidsFinW *= Math.abs(this.offsetAngle / 30)
            }
            break;

        case "RIGHT":
            v.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.offsetAngle * DEG2RAD);
            break;

        case "LEFT":
            v.applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.offsetAngle * DEG2RAD);
            break;

        case "UP":
            v = new THREE.Vector3(1, 0, 0);
            q.setFromAxisAngle(v, -45 * DEG2RAD);
            v.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.offsetAngle * DEG2RAD);
            v.applyQuaternion(q);
            if (this.isEyes) {
                this.squintFinW *= Math.abs(this.offsetAngle / 30)
            }
            break;
        case "DOWN":
            /* quat.setAxisAngle(q, v, 45*DEG2RAD);//quat.setAxisAngle(q, v, 90*DEG2RAD);
             vec3.rotateY(v,v, this.offsetAngle*DEG2RAD);
             vec3.transformQuat(v,v,q);*/

            // let c = v.clone();
            // c.cross(new THREE.Vector3(0,1,0));
            // let q = new THREE.Quaternion();
            // q.setFromAxisAngle(c, this.offsetAngle*DEG2RAD)
            // //q.setFromAxisAngle(new, 0)//45*DEG2RAD);
            // //c.applyAxisAngle(c, this.offsetAngle*DEG2RAD);
            // v.applyQuaternion(q);
            // v.normalize()
            if (this.isEyes) {
                this.eyelidsFinW *= Math.abs(this.offsetAngle / 30)
            }
            break;
    }
    
    // Move to head position and save modified target position
    v.addScaledVector(v, magn);
    v.addVectors(v, this.headPos);
    this.targetP.copy(v)

    if (!this.lookAt || !this.lookAt.position)
        return console.log("ERROR: lookAt not defined ", this.lookAt);

    // Define initial and end positions
    this.InP = this.lookAt.position.clone();
    this.EndP = this.targetP.clone(); // why copy? targetP shared with several?
}


// --------------------- HEAD ---------------------
// BML
// <head start ready strokeStart stroke strokeEnd relax end lexeme repetition amount>
// lexeme [NOD, SHAKE, TILT, TILT_LEFT, TILT_RIGHT, TILT_FORWARD, TILT_BACKWARD, FORWARD, BACKWARD]
// repetition cancels stroke attr
// amount how intense is the head nod? 0 to 1

// head nods will go slightly up -> position = ready&stroke_start and stroke_end&relax
// Should work together with gaze. Check how far is from the top-bottom angle limits or right-left angle limits
// Scene inputs: head bone node, neutral rotation and lookAtComponent rotation
// Combination of gaze and lookAtComponent:
//if (this.headBML.transition){
//  this._lookAtHeadComponent.applyRotation = false;
//  this.headBML.update(dt);
//} else
//  this._lookAtHeadComponent.applyRotation = true;

// Constructor
// headNode is to combine gaze rotations and head behavior
function HeadBML(headData, headNode, lookAtRot, limVert, limHor) {

    // Rotation limits (from lookAt component for example)
    this.limVert = Math.abs(limVert) || 20;
    this.limHor = Math.abs(limHor) || 30;

    // Scene variables
    this.headNode = headNode;
    this.lookAtRot = new THREE.Quaternion(lookAtRot.x, lookAtRot.y, lookAtRot.z, lookAtRot.w);

    // Init variables
    this.initHeadData(headData);
}

// Init variables
HeadBML.prototype.initHeadData = function (headData) {
    
    // start -> ready -> strokeStart -> stroke -> strokeEnd -> relax -> end

    headData.lexeme = stringToUpperCase(headData.lexeme, "Head lexeme", "NOD");

    // Lexeme, repetition and amount
    this.lexeme = headData.lexeme || "NOD";
    this.amount = headData.amount || 0.2;

    // Maximum rotation amplitude
    if (this.lexeme == "NOD" || this.lexeme == "TILT_LEFT" || this.lexeme == "TILT_RIGHT" || this.lexeme == "TILT_FORWARD" || this.lexeme == "TILT_BACKWARD" || this.lexeme == "FORWARD" || this.lexeme == "BACKWARD")
        this.maxDeg = this.limVert * 2;
    else
        this.maxDeg = this.limHor * 2;

    // Sync start ready strokeStart stroke strokeEnd relax end
    this.start = headData.start || 0;
    this.end = headData.end || 2.0;

    this.ready = headData.ready || headData.strokeStart || (this.end / 4);
    this.relax = headData.relax || headData.strokeEnd || (this.end * 3 / 4);

    this.strokeStart = headData.strokeStart || this.ready;
    this.strokeEnd = headData.strokeEnd || this.relax;


    this.repetition = (isNaN(headData.repetition)) ? 0 : Math.abs(headData.repetition);
    this.repeatedIndx = 0;

    // Modify stroke and strokeEnd with repetition
    this.strokeEnd = this.strokeStart + (this.strokeEnd - this.strokeStart) / (1 + this.repetition)
    this.stroke = (this.strokeStart + this.strokeEnd) / 2;

    // Start
    this.transition = true;
    this.phase = 0;
    this.time = 0;

    this.currentAngle = 0;
    // Define initial values
    this.initHeadValues();
}

HeadBML.prototype.initHeadValues = function () {

    // Head initial rotation
    this.inQ = this.headNode.quaternion.clone();

    // Compare rotations to know which side to rotate
    // Amount of rotation
    var neutralInv = this.lookAtRot.clone().invert();
    var rotAmount = neutralInv.clone();
    rotAmount.multiply(this.inQ);
    var eulerRot = new THREE.Euler().setFromQuaternion(rotAmount);

    // X -> right(neg) left(pos)
    // Z -> up(neg) down(pos)

    // in here we choose which side to rotate and how much according to limits
    // the lookAt component should be stopped here (or set to not modify node, only final lookAt quat output)
    this.strokeAxis = new THREE.Vector3(1, 0, 0);
    this.strokeDeg = 0; // degrees of stroke
    this.readyDeg = 0; // ready will have some inertia in the opposite direction of stroke 

    switch ( this.lexeme ) {
        case "NOD":
            // nod will always be downwards
            this.strokeAxis.set(1, 0, 0);
            this.strokeDeg = this.amount * this.maxDeg;
            this.readyDeg = this.strokeDeg * 0.5;

            // If the stroke rotation passes the limit, change readyDeg
            if (eulerRot.z * RAD2DEG + this.strokeDeg > this.limVert)
                this.readyDeg = this.strokeDeg - this.limVert + eulerRot.z * RAD2DEG;
            break;
        
        case "SHAKE":
            this.strokeAxis.set(0, 1, 0);

            this.strokeDeg = this.amount * this.maxDeg;
            this.readyDeg = this.strokeDeg * 0.5;

            // Sign (left rigth)
            this.RorL = Math.sign(eulerRot.y) ? Math.sign(eulerRot.y) : 1;
            this.readyDeg *= -this.RorL;
            this.strokeDeg *= -this.RorL;
            break;
    
        case "TILT":
            this.strokeAxis.set(0, 0, 1);
            this.strokeDeg = this.amount * 20;
            this.readyDeg = this.strokeDeg * 0.5;
            break;
    
        case "ROTATE_LEFT":
            this.strokeAxis.set(0, -1, 0);
            this.strokeDeg = this.amount * this.maxDeg;
            this.readyDeg = this.strokeDeg * 0.8;
            if(!this.repetition) {
                
                this.strokeStart = this.ready;
                this.strokeEnd = this.relax;
            }
            break;
        
        case "ROTATE_RIGHT":
            this.strokeAxis.set(0, 1, 0);
            this.strokeDeg = this.amount * this.maxDeg;
            this.readyDeg = this.strokeDeg * 0.8;
            if(!this.repetition) {
                
                this.strokeStart = this.ready;
                this.strokeEnd = this.relax;
            }
            break;

        case "TILT_LEFT":
            this.strokeAxis.set(0, 0, 1);
            this.strokeDeg = this.amount * this.maxDeg;
            this.readyDeg = this.strokeDeg * 0.8;
            if(!this.repetition) {
                
                this.strokeStart = this.ready;
                this.strokeEnd = this.relax;
            }
            break;

        case "TILT_RIGHT":
            this.strokeAxis.set(0, 0, -1);
            this.strokeDeg = this.amount * this.maxDeg;
            this.readyDeg = this.strokeDeg * 0.8;
            if(!this.repetition) {
                
                this.strokeStart = this.ready;
                this.strokeEnd = this.relax;
            }
            break;
        
        case "TILT_FORWARD":
            this.strokeAxis.set(-1, 0, 0);
            this.strokeDeg = this.amount * this.maxDeg;
            this.readyDeg = this.strokeDeg * 0.8;
            if(!this.repetition) {
                
                this.strokeStart = this.ready;
                this.strokeEnd = this.relax;
            }
            break;

        case "TILT_BACKWARD":
            this.strokeAxis.set(1, 0, 0);
            this.strokeDeg = this.amount * this.maxDeg;
            this.readyDeg = this.strokeDeg * 0.8;
            if(!this.repetition) {
                
                this.strokeStart = this.ready;
                this.strokeEnd = this.relax;
            }
            break;
            
        case "FORWARD":
            // nod will always be downwards
            this.strokeAxis.set(-1, 0, 0);
            this.strokeDeg = this.amount * this.maxDeg ;
            this.readyDeg = this.strokeDeg * 0.8;
            if(!this.repetition) {
                
                this.strokeStart = this.ready;
                this.strokeEnd = this.relax;
            }
            break;

        case "BACKWARD":
            // nod will always be downwards
            this.strokeAxis.set(1, 0, 0);
            this.strokeDeg = this.amount *  this.maxDeg;
            this.readyDeg = this.strokeDeg * 0.8;
            if(!this.repetition) {
                
                this.strokeStart = this.ready;
                this.strokeEnd = this.relax;
            }
            break;
    }

    this.currentStrokeQuat = new THREE.Quaternion(); this.currentStrokeQuat.setFromAxisAngle(this.strokeAxis, 0); // current state of rotation
}


HeadBML.prototype.update = function (dt) {

    // Time increase
    this.time += dt;
    let inter = 0;
    // Wait for to reach start time
    if (this.time < this.start)
        return;

    // Repetition -> Redefine strokeStart, stroke and strokeEnd before update
    if (this.time < this.relax && this.time >= this.strokeEnd && this.repeatedIndx < this.repetition) {
        this.repeatedIndx++;
        let timeRep = (this.strokeEnd - this.strokeStart);
        this.strokeStart = this.strokeEnd;
        this.strokeEnd += timeRep;
        this.stroke = (this.strokeEnd + this.strokeStart) / 2;

        this.phase = 0;
    }

    // Ready
    if (this.time <= this.ready) {
        inter = (this.time - this.start) / (this.ready - this.start);
        // Cosine interpolation
        inter = Math.cos(Math.PI * inter + Math.PI) * 0.5 + 0.5;

        this.currentAngle = -this.readyDeg * inter;
        this.currentStrokeQuat.setFromAxisAngle(this.strokeAxis, this.currentAngle * DEG2RAD);
    }

    // StrokeStart
    else if (this.time > this.ready && this.time < this.strokeStart) {
        return;
    }

    // Stroke (phase 1)
    else if (this.time >= this.strokeStart && this.time <= this.stroke ) {
        inter = (this.time - this.strokeStart) / (this.stroke - this.strokeStart);
        // Cosine interpolation
        inter = Math.cos(Math.PI * inter + Math.PI) * 0.5 + 0.5;

        if (this.phase != 1 ) {
            if(this.repeatedIndx >= this.repetition && this.lexeme != "TILT" && this.lexeme != "NOD" && this.lexeme != "SHAKE" )
                return;
            this.phase = 1;
        }

        this.currentAngle = -this.readyDeg + inter * this.strokeDeg;
        this.currentStrokeQuat.setFromAxisAngle(this.strokeAxis, this.currentAngle * DEG2RAD);
    }

    // Stroke (phase 2)
    else if (this.time > this.stroke && this.time <= this.strokeEnd && this.repeatedIndx < this.repetition) {
        inter = (this.time - this.stroke) / (this.strokeEnd - this.stroke);
        // Cosine interpolation
        inter = Math.cos(Math.PI * inter + Math.PI) * 0.5 + 0.5;

        if (this.phase != 2) {
            this.phase = 2;
        }

        this.currentAngle = -this.readyDeg + ( 1 - inter ) * this.strokeDeg;
        this.currentStrokeQuat.setFromAxisAngle(this.strokeAxis, this.currentAngle * DEG2RAD);
    }
   
    // StrokeEnd (no repetition)
    else if (this.time >= this.strokeEnd && this.time < this.relax) {
        return;
    }

    // Relax -> Move towards lookAt final rotation
    else if (this.time > this.relax && this.time <= this.end) {
        inter = (this.time - this.relax) / (this.end - this.relax);
        // Cosine interpolation
        inter = Math.cos(Math.PI * inter + Math.PI) * 0.5 + 0.5;
        this.currentStrokeQuat.setFromAxisAngle(this.strokeAxis, (1-inter) * this.currentAngle * DEG2RAD);
    }

    // End
    else if (this.time > this.end) {
        this.currentStrokeQuat.set(0,0,0,1);
        this.transition = false
        return;
    }

}

// Turn to upper case and error check
var stringToUpperCase = function (item, textItem, def) {
    // To upper case
    if (Object.prototype.toString.call(item) === '[object String]')
        return item.toUpperCase();
    else { // No string
        //console.warn(textItem + " not defined properly.", item);
        return def;
    }
}

// --------------------- LIPSYNC MODULE --------------------

// // Switch to https if using this script
// if (window.location.protocol != "https:")
//     window.location.href = "https:" + window.location.href.substring(window.location.protocol.length);

// // Audio context
// if (!Lipsync.AContext)
// Lipsync.AContext = new AudioContext();

// Audio sources

Lipsync.prototype.refFBins = [0, 500, 700, 3000, 6000];

// Constructor
function Lipsync(threshold, smoothness, pitch) {

    // Freq analysis bins, energy and lipsync vectors
    this.energy = [0, 0, 0, 0, 0, 0, 0, 0];
    this.BSW = [0, 0, 0]; //kiss,lipsClosed,jaw

    // Lipsync parameters
    this.threshold = threshold || 0.0;
    this.dynamics = 30;
    this.maxDB = -30;

    this.smoothness = smoothness || 0.6;
    this.pitch = pitch || 1;
    // Change freq bins according to pitch
    this.fBins = [];
    this.defineFBins(this.pitch);

    // Initialize buffers
    this.init();

    // Output .csv (debug)
    //this.outstr = "time, e0, e1, e2, e3, bs_kiss, bs_lips_closed, bs_jaw\n";

    this.working = false;
}

// Start mic input
Lipsync.prototype.start = function (URL) {

    // Audio context
    if (!Lipsync.AContext)
        Lipsync.AContext = new AudioContext();
    // Restart
    this.stopSample();

    thatLip = this;
    if (URL === undefined) {
        /* navigator.getUserMedia({audio: true}, function(stream) {
          thatLip.stream = stream;
          thatLip.sample = thatLip.context.createMediaStreamSource(stream);
          thatLip.sample.connect(thatLip.analyser);
          console.log("Mic sampling rate:", thatLip.context.sampleRate);
          thatLip.analyser.disconnect();
          thatLip.gainNode.disconnect();
          thatLip.working = true;
        }, function(e){console.error("ERROR: get user media: ", e);});*/
    } else {
        this.loadSample(URL);
    }
}

Lipsync.prototype.loadBlob = function (blob) {

    // Audio context
    if (Lipsync.AContext)
        Lipsync.AContext.resume();
    const fileReader = new FileReader()

    // Set up file reader on loaded end event
    fileReader.onloadend = () => {

        const arrayBuffer = fileReader.result;
        var that = this;
        this.context.decodeAudioData(arrayBuffer,
            function (buffer) {
                //LGAudio.cached_audios[URL] = buffer;
                that.stopSample();

                that.sample = Lipsync.AContext.createBufferSource();
                that.sample.buffer = buffer;
                console.log("Audio loaded");
                that.playSample();
            }, function (e) { console.log("Failed to load audio"); });
    };

    //Load blob
    fileReader.readAsArrayBuffer(getBlobURL(blob))
}

Lipsync.prototype.loadSample = function (inURL) {
    
    var URL = LS.RM.getFullURL(inURL);

    if (LGAudio.cached_audios[URL] && URL.indexOf("blob:") == -1) {
        this.stopSample();
        this.sample = Lipsync.AContext.createBufferSource();
        this.sample.buffer = LGAudio.cached_audios[URL];
        this.playSample();
    } else {
        var request = new XMLHttpRequest();
        request.open('GET', URL, true);
        request.responseType = 'arraybuffer';

        var that = this;
        request.onload = function () {
            that.context.decodeAudioData(request.response,
                function (buffer) {
                    LGAudio.cached_audios[URL] = buffer;
                    that.stopSample();
                    that.sample = Lipsync.AContext.createBufferSource();
                    that.sample.buffer = buffer;
                    console.log("Audio loaded");
                    that.playSample();
                }, function (e) { console.log("Failed to load audio"); });
        };

        request.send();
    }
}

Lipsync.prototype.playSample = function () {

    // Sample to analyzer
    this.sample.connect(this.analyser);
    // Analyzer to Gain
    this.analyser.connect(this.gainNode);
    // Gain to Hardware
    this.gainNode.connect(this.context.destination);
    // Volume
    this.gainNode.gain.value = 1;
    console.log("Sample rate: ", this.context.sampleRate);
    var that = this;
    this.working = true;
    this.sample.onended = function () { that.working = false; };
    // start
    this.sample.start(0);
    //this.sample.loop = true;

    // Output stream (debug)
    //this.timeStart = thiscene.time;
    //this.outstr = "time, e0, e1, e2, e3, bs_kiss, bs_lips_closed, bs_jaw\n";
}

// Update lipsync weights
Lipsync.prototype.update = function () {

    if (!this.working)
        return;

    // FFT data
    if (!this.analyser) {
        //if (this.gainNode){
        // Analyser
        this.analyser = this.context.createAnalyser();
        // FFT size
        this.analyser.fftSize = 1024;
        // FFT smoothing
        this.analyser.smoothingTimeConstant = this.smoothness;

        //}
        //else return;
    }

    // Short-term power spectrum
    this.analyser.getFloatFrequencyData(this.data);

    // Analyze energies
    this.binAnalysis();
    // Calculate lipsync blenshape weights
    this.lipAnalysis();
}

Lipsync.prototype.stop = function (dt) {
    
    // Immediate stop
    if (dt === undefined) {
        // Stop mic input
        this.stopSample();

        this.working = false;
    }
    // Delayed stop
    else {
        thatLip = this;
        setTimeout(thatLip.stop.bind(thatLip), dt * 1000);
    }
}

// Define fBins
Lipsync.prototype.defineFBins = function (pitch) {
    
    for (var i = 0; i < this.refFBins.length; i++)
        this.fBins[i] = this.refFBins[i] * pitch;
}

// Audio buffers and analysers
Lipsync.prototype.init = function () {

    // Audio context
    if (!Lipsync.AContext)
        Lipsync.AContext = new AudioContext();
    var context = this.context = Lipsync.AContext;
    // Sound source
    this.sample = context.createBufferSource();
    // Gain Node
    this.gainNode = context.createGain();
    // Analyser
    this.analyser = context.createAnalyser();
    // FFT size
    this.analyser.fftSize = 1024;
    // FFT smoothing
    this.analyser.smoothingTimeConstant = this.smoothness;
    // FFT buffer
    this.data = new Float32Array(this.analyser.frequencyBinCount);
}

// Analyze energies
Lipsync.prototype.binAnalysis = function () {

    // Signal properties
    var nfft = this.analyser.frequencyBinCount;
    var fs = this.context.sampleRate;

    var fBins = this.fBins;
    var energy = this.energy;

    // Energy of bins
    for (var binInd = 0; binInd < fBins.length - 1; binInd++) {
        // Start and end of bin
        var indxIn = Math.round(fBins[binInd] * nfft / (fs / 2));
        var indxEnd = Math.round(fBins[binInd + 1] * nfft / (fs / 2));

        // Sum of freq values
        energy[binInd] = 0;
        for (var i = indxIn; i < indxEnd; i++) {
            // Power Spectogram
            //var value = Math.pow(10, this.data[i]/10);
            // Previous approach
            var value = 0.5 + (this.data[i] + 20) / 140;
            if (value < 0) value = 0;
            energy[binInd] += value;
        }
        // Divide by number of sumples
        energy[binInd] /= (indxEnd - indxIn);
        // Logarithmic scale
        //energy[binInd] = 10*Math.log10(energy[binInd] + 1E-6);
        // Dynamic scaling
        //energy[binInd] = ( energy[binInd] - this.maxDB)/this.dynamics + 1 - this.threshold;
    }
}

// Calculate lipsyncBSW
Lipsync.prototype.lipAnalysis = function () {

    var energy = this.energy;

    if (energy !== undefined) {

        var value = 0;

        // Kiss blend shape
        // When there is energy in the 1 and 2 bin, blend shape is 0
        value = (0.5 - (energy[2])) * 2;
        if (energy[1] < 0.2)
            value = value * (energy[1] * 5)
        value = Math.max(0, Math.min(value, 1)); // Clip
        this.BSW[0] = value;

        // Lips closed blend shape
        value = energy[3] * 3;
        value = Math.max(0, Math.min(value, 1)); // Clip
        this.BSW[1] = value;

        // Jaw blend shape
        value = energy[1] * 0.8 - energy[3] * 0.8;
        value = Math.max(0, Math.min(value, 1)); // Clip
        this.BSW[2] = value;
    }
}

// Stops mic input
Lipsync.prototype.stopSample = function () {
    
    // If AudioBufferSourceNode has started
    if (this.sample)
        if (this.sample.buffer)
            this.sample.stop(0);

    // If microphone input
    if (this.stream) {
        var tracks = this.stream.getTracks();
        for (var i = 0; i < tracks.length; i++)
            if (tracks[i].kind = "audio")
                tracks[i].stop();
        this.stream = null;
    }
}

function getBlobURL(arrayBuffer) {
    var i, l, d, array;
    d = arrayBuffer;
    l = d.length;
    array = new Uint8Array(l);
    for (var i = 0; i < l; i++) {
        array[i] = d.charCodeAt(i);
    }
    var b = new Blob([array], { type: 'application/octet-stream' });
    // let blob = blobUtil.arrayBufferToBlob(arrayBuffer, "audio/wav")
    return b
}


// ------------------------ TEXT TO LIP --------------------------------------------

function Text2LipInterface() {
    
    let _ = new Text2Lip();

    this.start = _.start.bind( _ );
    this.stop = _.stop.bind( _ );
    this.pause = _.pause.bind( _ );
    this.resume = _.resume.bind( _ );

    this.update = _.update.bind( _ );

    this.setEvent = _.setEvent.bind( _ );
    this.setTables = _.setTables.bind( _ );
    this.setDefaultSpeed = _.setDefaultSpeed.bind( _ );
    this.setDefaultIntensity = _.setDefaultIntensity.bind( _ );
    this.setSourceBSWValues = _.setSourceBSWValues.bind( _ );

    this.getDefaultSpeed = _.getDefaultSpeed.bind( _ );
    this.getDefaultIntensity = _.getDefaultIntensity.bind( _ );
    this.getCurrentIntensity = _.getCurrentIntensity.bind( _ );


    this.getSentenceDuration = _.getSentenceDuration.bind( _ ); // THE ONLY REASON THIS IS NOT STATIC IS BECAUSE IT USES this.DEFAULT_SPEED   
    this.cleanQueueSentences = _.cleanQueueSentences.bind( _ );
    this.pushSentence = _.pushSentence.bind( _ );

    this.getBSW = function () { return _.BSW; }

    this.getCompactState = _.getCompactState.bind( _ );
    this.isWorking = _.isWorking.bind( _ );
    this.isPaused = _.isPaused.bind( _ );
    this.needsSentences = _.needsSentences.bind( _ );
    this.getNumSentences = _.getNumSentences.bind( _ );
    this.getMaxNumSentences = _.getMaxNumSentences.bind( _ );
}

function Text2Lip() {
    
    this.DEFAULT_SPEED = 8; // phonemes/s
    this.DEFAULT_INTENSITY = 0.5; // [0,1]

    // tables ( references )
    this.lowerBoundVisemes = null;
    this.upperBoundVisemes = null;
    this.coarts = null;
    this.ph2v = null;
    this.numShapes = 0;

    // manages display of a sentence
    this.working = false;
    this.paused = false;
    this.speed = this.DEFAULT_SPEED; // phonemes/s
    this.intensity = this.DEFAULT_INTENSITY; // [0,1]
    this.text = "";
    this.currTargetIdx = 0; // current target character (aka when t=1 during interpolation, this char is shown)
    this.currT = 0; // current time of interpolation
    this.useCoarticulation = true;
    this.delay = 0;

    // variables for managing list of sentences to display
    this.currSent = null;
    this.queueIdx = 0;
    this.queueSize = 0;
    this.sentenceQueue = new Array( Text2Lip.QUEUE_MAX_SIZE );
    this.sentenceIDCount = 1; // when pushing, a 0 will mean failure. Start IDs at 1

    // blendshape weights. User can use this to do mouthing
    this.BSW = new Float32Array( this.numShapes ); this.BSW.fill( 0 );

    // needed because of coarticulation
    this.currV = new Float32Array( this.numShapes ); this.currV.fill( 0 );
    this.targV = new Float32Array( this.numShapes ); this.targV.fill( 0 ); // next visem - target

    // event listeners
    this.onIdle = null;
    this.onSentenceEnd = null; // receives ended sentence
    this.onSentenceStart = null; // receives starting sentence

    // default setup
    this.setTables( T2LTABLES.PhonemeToViseme, T2LTABLES.Coarticulations, T2LTABLES.LowerBound, T2LTABLES.UpperBound );
}

Text2Lip.prototype.setDefaultSpeed = function ( speed ) {
    if ( typeof ( speed ) === 'number' && speed > 0.001 ) {
        this.DEFAULT_SPEED = speed;
        return true;
    }
    return false;
};

Text2Lip.prototype.setDefaultIntensity = function ( intensity ) {
    if ( typeof ( intensity ) === 'number' ) {
        this.DEFAULT_INTENSITY = Math.max( 0.0, Math.min( 1.0, intensity ) );
        return true;
    }
    return false;
};

Text2Lip.prototype.setSourceBSWValues = function ( values ) {
    // values is only a number
    if ( typeof ( values ) == "number" ) {
        for ( let i = 0; i < this.currV.length; ++i ) {
            this.currV[ i ] = values;
        }
        return;
    }

    // values is an array
    for ( let i = 0; i < this.BSW.length && i < values.length; ++i ) {
        let value = ( typeof ( values[ i ] ) == "number" ) ? values[ i ] : 0.0;
        this.currV[ i ] = value;
    }
}

Text2Lip.prototype.setEvent = function ( eventType, fun ) {
    if ( typeof ( fun ) !== 'function' ) { return false; }
    switch ( eventType ) {
        case "onIdle": this.onIdle = fun; break;
        case "onSentenceEnd": this.onSentenceEnd = fun; break;
        case "onSentenceStart": this.onSentenceStart = fun; break;
        default: return false;
    }
    return true;
}

Text2Lip.prototype.setTables = function ( phonemeToViseme, coarts, lowerBoundVisemes, upperBoundVisemes = null ) {
    this.lowerBoundVisemes = lowerBoundVisemes;
    this.upperBoundVisemes = ( upperBoundVisemes && upperBoundVisemes.length > 0 ) ? upperBoundVisemes : lowerBoundVisemes;
    this.coarts = coarts;
    this.ph2v = phonemeToViseme;

    this.numShapes = 0
    if ( lowerBoundVisemes && lowerBoundVisemes.length > 0 ) {
        this.numShapes = lowerBoundVisemes[ 0 ].length;
    }

    this.BSW = new Float32Array( this.numShapes ); this.BSW.fill( 0 );
    this.currV = new Float32Array( this.numShapes ); this.currV.fill( 0 );
    this.targV = new Float32Array( this.numShapes ); this.targV.fill( 0 ); // next visem - target
}

Text2Lip.prototype.getDefaultSpeed = function () { return this.DEFAULT_SPEED; }
Text2Lip.prototype.getDefaultIntensity = function () { return this.DEFAULT_INTENSITY; }
Text2Lip.prototype.getCurrentIntensity = function () { return this.getIntensityAtIndex( this.currTargetIdx ); }

Text2Lip.prototype.getIntensityAtIndex = function ( index ) {
    if ( this.currSent ) {
        if ( index >= 0 && index < this.currSent.text.length ) {
            let phInt = this.currSent.phInt;
            if ( phInt && index < phInt.length ) { return phInt[ index ]; }
            else if ( this.currSent.sentInt !== null ) { return this.currSent.sentInt; }
        }
    }
    return this.DEFAULT_INTENSITY;
}

/**
* 
* @param {*} phoneme 
* @param {Array} outResult if not null, result will be written to this array. Otherwise a new array is generated with the resulting values and returned 
* @returns returns outResult or a new Float32Array
*/
Text2Lip.prototype.getViseme = function ( phoneme, outResult = null, ) {
    // this handles properly undefined and nulls.
    if ( !( phoneme in this.ph2v ) ) { return this.lowerBoundVisemes[ 0 ]; } // assuming there are visemes
    let visIdx = this.ph2v[ phoneme ];
    if ( visIdx < 0 || visIdx >= this.lowerBoundVisemes.length ) { return this.lowerBoundVisemes[ 0 ]; } // assuming there are visemes

    let lower = this.lowerBoundVisemes[ visIdx ];
    let upper = this.upperBoundVisemes[ visIdx ];

    let result = ( outResult ) ? outResult : ( new Float32Array( this.numShapes ) );
    let intensity = this.intensity;
    for ( let i = 0; i < this.numShapes; i++ ) {
        result[ i ] = lower[ i ] * ( 1 - intensity ) + upper[ i ] * intensity;
    }
    return result;
}

/**
* 
* @param {*} phoneme 
* @returns returns a reference to the coart entry
*/
Text2Lip.prototype.getCoarts = function ( phoneme ) {
    // this handles properly undefined and nulls.
    if ( !( phoneme in this.ph2v ) ) { return this.coarts[ 0 ]; } // assuming there are coarts
    let visIdx = this.ph2v[ phoneme ];
    if ( visIdx < 0 || visIdx >= this.coarts.length ) { return this.coarts[ 0 ]; } // assuming there are visemes
    return this.coarts[ visIdx ];
}

/**
* 
* @param {*} phoneme 
* @param {*} phonemeAfter 
* @param {*} outResult  if not null, result will be written to this array. Otherwise a new array is generated with the resulting values and returned 
* @returns returns outResult or a new Float32Array
*/
Text2Lip.prototype.getCoarticulatedViseme = function ( phoneme, phonemeAfter, outResult = null ) {
    let rawTarget = this.getViseme( phoneme );
    let coartsW = this.getCoarts( phoneme ); // coarticulation weights of target phoneme

    //let visemePrev = this.currV; // phoneme before target
    let visemeAfter = this.getViseme( phonemeAfter ); // phoneme after target

    let result = ( outResult ) ? outResult : ( new Float32Array( this.numShapes ) );

    for ( let i = 0; i < this.numShapes; ++i ) {
        result[ i ] = ( 1.0 - coartsW[ i ] ) * rawTarget[ i ] + coartsW[ i ] * visemeAfter[ i ]//(0.2 * visemePrev[i] + 0.8 * visemeAfter[i]);
    }

    return result;
}

// constant
Text2Lip.QUEUE_MAX_SIZE = 32;

Text2Lip.prototype.start = function () {
    this.stop( false );
    this.working = true;
    this.paused = false;

    this.changeCurrentSentence( false );
}

Text2Lip.prototype.pause = function () { this.paused = this.working; } // can only be paused if working
Text2Lip.prototype.resume = function () { this.paused = false; }

/**
* stops update. No sentence is modified. However some variables are reseted, meaning the sentence being displayed currently will start from the beginning 
* if a start is called
* To completely clean the queue, call cleanQueueSentences or pass true as argument
* @param {Bool} cleanQueue if true, all pending sentences are cleared and will not be displayed. 
*/
Text2Lip.prototype.stop = function ( cleanQueue = false ) {
    this.working = false;
    this.paused = false;
    this.currTargetIdx = 0; // for a smooth intro
    this.currT = 0;

    this.BSW.fill( 0 );
    this.currV.fill( 0 );
    this.targV.fill( 0 );

    if ( !!cleanQueue ) // force to be boolean
        this.cleanQueueSentences();
}

/**
* returns a number 
* Bit 0: set when module is not working ( stopped )
* Bit 1: set when module is working but paused
* Bit 2: set when module does not have more sentences to compute. If working, it is idle, waiting for some push
* if the entire value is 0, the module is actively working
* @returns 
*/
Text2Lip.prototype.getCompactState = function () {
    let result = !this.working;
    result |= this.paused << 1;
    result |= ( !this.queueSize ) << 2;
    return result;
}

Text2Lip.prototype.isWorking = function () { return this.working; }
Text2Lip.prototype.isPaused = function () { return this.paused; }
Text2Lip.prototype.needsSentences = function () { return !this.queueSize; }
Text2Lip.prototype.getNumSentences = function () { return this.queueSize; }
Text2Lip.prototype.getMaxNumSentences = function () { return Text2Lip.QUEUE_MAX_SIZE; }

Text2Lip.prototype.update = function ( dt ) {
    if ( !this.working || this.paused || !this.currSent ) { return; }

    // check for sentence delay
    if ( this.delay > 0.001 ) {
        this.delay -= dt;

        if ( this.delay >= 0.0 ) {
            return;
        }
        dt = -this.delay;
        this.delay = 0;
        if ( dt < 0.001 ) return;
    }
    let durations = this.currSent.phT;

    let invSpeed = 1.0 / this.speed; // seconds / phoneme
    this.currT += dt;

    let p = 0;
    let t = 0;
    let useGeneralSpeed = true; // when durations array ends, it should continue with general speed
    // use specific phoneme durations
    if ( durations && this.currTargetIdx < durations.length ) {
        useGeneralSpeed = false;
        let durationIdx = this.currTargetIdx;
        while ( durationIdx < durations.length && durations[ durationIdx ] < this.currT ) {
            this.currT -= Math.max( 0.001, durations[ durationIdx ] );
            durationIdx++;
            p++;
        }
        useGeneralSpeed = durationIdx >= durations.length; // durations array has ended. Check general speed
        this.currT = Math.max( 0, this.currT ); // just in case
        t = ( durationIdx < durations.length ) ? ( this.currT / durations[ durationIdx ] ) : Math.max( 0.0, Math.min( 1.0, this.currT * this.speed ) ); // after phoneme ease-in, t will be clamped to 1 until phoneme change
        this.currTargetIdx = durationIdx;
    }

    // no more specific phoneme durations and there is enough time to check 
    if ( useGeneralSpeed ) {
        // use temporal p variable to avoid overwriting durations array result
        let general_p = Math.floor( this.currT * this.speed ); // complete phonemes 
        t = ( this.currT * this.speed ) - general_p;  // remaining piece of phoneme, used on interpolation
        this.currT -= general_p * invSpeed;
        this.currTargetIdx += general_p;
        p += general_p;
    }


    // t function modifier;
    //t = 0.5* Math.sin( t * Math.PI - Math.PI * 0.5 ) +0.5; // weird on slow phonemes

    // phoneme changed
    if ( p > 0 ) {

        // copy target values to source Viseme. Several phonemes may have passed during this frame. Take the last real target phoneme
        // let lastPhonemeIndex = Math.max( 0.0, Math.min( this.text.length - 1, this.currTargetIdx - 1 ) ); // currTargetIdx here is always > 0. text.length here is always > 0
        // this.intensity = this.getIntensityAtIndex( lastPhonemeIndex ); // get last real target viseme with correct intensity, in case more than 1 phoneme change in the same frame

        // let lastPhoneme = this.text[ lastPhonemeIndex ];
            
        // if ( this.useCoarticulation ){
        //     let lastPhonemeNext = ( lastPhonemeIndex == ( this.text.length - 1 ) ) ? null : ( this.text[ lastPhonemeIndex + 1 ] );
        //     this.getCoarticulatedViseme( lastPhoneme, lastPhonemeNext, this.currV );
        // }
        // else{
        //     this.getViseme( lastPhoneme, this.currV );
        // }
        for ( let i = 0; i < this.numShapes; ++i ) {
            this.currV[ i ] = this.BSW[ i ];
        }

        // end of sentence reached
        if ( this.currTargetIdx >= this.text.length ) {
            this.getViseme( this.text[ this.text.length-1 ], this.currV );
            for ( let i = 0; i < this.numShapes; ++i ) { this.BSW[ i ] = this.currV[ i ]; } // currV holds the last real target phoneme
            this.changeCurrentSentence();
            return;
        }

        this.intensity = this.getIntensityAtIndex( this.currTargetIdx ); // get intensity for next target

        if ( !this.useCoarticulation ) {
            this.getViseme( this.text[ this.currTargetIdx ], this.targV );
        }
        else {
            let targetPhoneme = this.text[ this.currTargetIdx ];
            let targetPhonemeNext = ( this.currTargetIdx == ( this.text.length - 1 ) ) ? null : this.text[ this.currTargetIdx + 1 ];
            this.getCoarticulatedViseme( targetPhoneme, targetPhonemeNext, this.targV );
        }
    }

    // final interpolation
    let BSW_0 = this.currV;
    let BSW_1 = this.targV;

    for ( let i = 0; i < this.numShapes; ++i ) {
        this.BSW[ i ] = ( 1.0 - t ) * BSW_0[ i ] + t * BSW_1[ i ];
    }
}

Text2Lip.prototype.cleanQueueSentences = function ( clearVisemes = false ) {
    this.queueIdx = 0;
    this.currSent = null;
    this.queueSize = 0;
    this.sentenceQueue.fill( null );
    
    if ( clearVisemes ){
        this.BSW.fill( 0 );
        this.currV.fill( 0 );
        this.targV.fill( 0 );
    }
}

/**
* sets all necessary parameters for the sentence indicated by queueIdx (if any).  
* @param {Bool} advanceIndex before setting paramters, index of sentence is incremented and amoun of sentences reduced, discarding the previous sentence
* @returns 
*/
Text2Lip.prototype.changeCurrentSentence = function ( advanceIndex = true ) {

    if ( advanceIndex ) { // when executing start(), do not advance 
        --this.queueSize;
        this.sentenceQueue[ this.queueIdx ] = null; // dereference obj
        this.queueIdx = ( this.queueIdx + 1 ) % Text2Lip.QUEUE_MAX_SIZE;

        // end events
        if ( this.currSent && this.onSentenceEnd ) { this.onSentenceEnd( this.currSent ); }
        if ( this.currSent.onEndEvent ) { this.currSent.onEndEvent(); }
    }

    if ( this.queueSize <= 0 ) {
        this.currT = 0;
        this.cleanQueueSentences();
        if ( this.onIdle ) { this.onIdle(); }
        return;
    }

    // parameters setup
    this.currSent = this.sentenceQueue[ this.queueIdx ];

    this.text = this.currSent.text;
    this.speed = this.currSent.speed;
    this.delay = this.currSent.delay;
    this.useCoarticulation = this.currSent.useCoart;

    this.currTargetIdx = 0;
    if ( !advanceIndex ) { this.currT = 0; } // reset timer only if called from start. Otherwise keep remaining time from previous sentence

    // target first phoneme
    this.intensity = this.getIntensityAtIndex( this.currTargetIdx ); // get target viseme with correct intensity

    if ( this.useCoarticulation ) {
        let targetPhoneme = this.text[ 0 ];
        let targetPhonemeNext = ( this.text.length > 1 ) ? this.text[ 1 ] : null;
        this.getCoarticulatedViseme( targetPhoneme, targetPhonemeNext, this.targV );
    }
    else {
        this.getViseme( this.text[ 0 ], this.targV );
    }

    // Start events
    if ( this.onSentenceStart ) { this.onSentenceStart( this.currSent ); } // generic start event
    if ( this.currSent.onStartEvent ) { this.currSent.onStartEvent(); }     // sentence specifici start event
}

/**
* Adds sentence to the queue.
WARNING!!!
Each sentence will have a smooth intro and outro. (from neutral to phoneme and from phoneme to neutral pose)
   - Intro time DOES NOT have to be accounted for on any timing
   - Outro time HAVE to be accounted for timings. If not included in sentT, the system will use default phoneme speed to transition to neutral. sentT should take it into account
Any value below 0.001 will be ignored.
* @param {string/array} text string of phonemes to display 
* @param {object} options object containing any of the optional string of phonemes to display.
* @param {Float32Array} phT (Optional) timing for each phoneme. Overrides sentT, speed and default speed.
* @param {Number} sentT (Optional): Number, timing (in seconds) of whole string. Overrides default speed and speed argument. Delay not included. Defaults to null.
* @param {Number} speed (Optional) phonemes/s of whole string. Overrides default speed. Delay not included.
* @param {Float32Array} phInt (Optional) intensity for each phoneme. Overrides sentInt and default intensity.
* @param {Number} sentInt (Optional) intensity of whole string. Overrides default intensity. Delay not included.
* @param {Boolean} useCoart (Optional) use coarticulation. Default to true.
* @param {Number} delay (Optional) delay to start playing this string. Delay starts at the end of the sentence it is being played now. If none, delay starts immediately.
* @param {Boolean} copyArrays (Optional) Whether to create new arrays and copy values or directly use the reference sent as argument. Defaults to false (only reference is used).
* @param {Boolean} outro (Optional) Whether to automatically include a final "." into the string to end in neutral pose. Defaults to false.
* @param {Function} onStartEvent (Optional) when sentence starts, this event is called after the generic onSentenceStart event.
* @param {Function} onEndEvent (Optional) when sentence ends, this event is called after the generic onSentenceEnd event.
* @returns the id number of the sentence if successful. 0 otherwise.
*/
Text2Lip.prototype.pushSentence = function ( text, options = {} ) {
    let phT = options.phT;
    let sentT = options.sentT;
    let speed = options.speed;
    let phInt = options.phInt;
    let sentInt = options.sentInt;
    let delay = options.delay;
    let outro = options.outro;
    let useCoart = options.useCoart;
    let copyArrays = options.copyArrays;
    let onEndEvent = options.onEndEvent;
    let onStartEvent = options.onStartEvent;

    if ( this.queueSize === Text2Lip.QUEUE_MAX_SIZE ) { return null; }
    if ( !text || !text.length ) { return null; }

    // clean input
    phT = phT ? new Float32Array( phT ) : null;
    phInt = phInt ? new Float32Array( phInt ) : null;

    if ( copyArrays ) {
        text = Array.from( text ); // create new array from
        if ( phT ) {
            let temp = new Float32Array( phT.length );
            temp.set( phT );
            phT = temp;
        }
        if ( phInt ) {
            let temp = new Float32Array( phInt.length );
            temp.set( phInt );
            phInt = temp;
        }
    }

    // put outro 
    if ( !!outro ) {
        if ( typeof ( text ) === 'string' ) { text = text + "."; }
        else { text.push( "." ); }
    }
    if ( text.length < 0 ) { return null; }


    let sentenceSpeed = this.DEFAULT_SPEED;
    if ( typeof ( speed ) === 'number' && !isNaN( speed ) && speed >= 0.001 ) { sentenceSpeed = speed; }
    if ( typeof ( sentT ) === 'number' && !isNaN( sentT ) && sentT >= 0.001 ) { sentenceSpeed = text.length / sentT; }
    if ( typeof ( delay ) !== 'number' || isNaN( delay ) || delay < 0 ) { delay = 0; }
    if ( typeof ( useCoart ) === 'undefined' ) { useCoart = true; } useCoart = !!useCoart;
    if ( !( onEndEvent instanceof Function ) ) { onEndEvent = null; }
    if ( !( onStartEvent instanceof Function ) ) { onStartEvent = null; }


    if ( typeof ( sentInt ) !== 'number' || isNaN( sentInt ) ) { sentInt = null; } // this allows for changing intensity while mouthing through setDefaulIntensity
    else { sentInt = Math.max( 0.0, Math.min( 1.0, sentInt ) ); }


    let id = this.sentenceIDCount++;
    let totalTime = this.getSentenceDuration( text, options ); // doing work twice, though...
    let sentenceObj = {
        id: id,
        totalTime: totalTime,
        text: text,
        phT: phT,
        speed: sentenceSpeed,
        phInt: phInt,
        sentInt: sentInt,
        useCoart: useCoart,
        delay: delay,
        onStartEvent: onStartEvent,
        onEndEvent: onEndEvent,
    }

    let indexPos = ( this.queueIdx + this.queueSize ) % Text2Lip.QUEUE_MAX_SIZE;
    this.sentenceQueue[ indexPos ] = sentenceObj; // only reference is copied
    this.queueSize++;

    // when working but idle because of no sentences, automatically play this new sentence
    if ( this.working && this.queueSize == 1 ) {
        this.changeCurrentSentence( false );
    }
    return { id: id, totalTime: totalTime };
};

/**
* Send the same info you would send to pushSentence.
* @param {string/array} text 
* @param {object} options 
* @returns in seconds
*/
Text2Lip.prototype.getSentenceDuration = function ( text, options ) {
    // THE ONLY REASON THIS IS NOT STAIC IS BECAUSE IT USES this.DEFAULT_SPEED   
    let phT = options.phT;
    let sentT = options.sentT;
    let speed = options.speed;
    let delay = options.delay;
    let outro = options.outro;

    if ( !text || !text.length ) { return 0; }
    if ( !( phT instanceof Float32Array ) ) phT = null;

    let textLength = text.length;
    if ( !!outro ) { textLength++; }
    let sentenceSpeed = this.DEFAULT_SPEED;
    if ( typeof ( speed ) === 'number' && !isNaN( speed ) && speed >= 0.001 ) sentenceSpeed = speed;
    if ( typeof ( sentT ) === 'number' && !isNaN( sentT ) && sentT >= 0.001 ) sentenceSpeed = textLength / sentT;

    if ( typeof ( delay ) !== 'number' || isNaN( delay ) || delay < 0 ) delay = 0;


    let totalTime = 0;
    totalTime += delay;

    if ( phT ) {
        let validEntries = ( phT.length >= textLength ) ? textLength : phT.length;
        for ( let i = 0; i < validEntries; ++i ) { totalTime += Math.max( phT[ i ], 0.001 ); }

        textLength -= validEntries;
    }

    // use sentence speed to compute time of phonemes with no phT
    totalTime += textLength * ( 1.0 / sentenceSpeed );

    return totalTime;
}

// TABLES ------------------------------

//[ "kiss", "upperLipClosed", "lowerLipClosed", "jawOpen", "tongueFrontUp", "tongueBackUp", "tongueOut" ],
let t2lLowerBound = [
  [ 0,     0,     0,     0,     0,     0,     0   ], // 0
  [ 0,     0,     0,     0,     0,     0,     0   ],
  [ 0.1,   0.15,  0,     0.2,   0,     0,     0   ],
  [ 0.0,   0.13,  0,     0.2,   0.2,   0,     0   ],
  [ 0,     0.08,  0,     0.1,   0.5,   0.5,   0   ], // 4
  [ 0.25,  0.15,  0.15,  0.2,   0,     0,     0   ],
  [ 0.35,  0.15,  0.15,  0.2,   0,     0,     0   ],
  [ 0.0,   0.15,  0,     0.1,   1,     0,     0   ],
  [ 0,     0.5,   0.2,   0.0,   0,     0,     0   ], // 8
  [ 0,     0.0,   0.2,   0.1,   0,     0,     0   ],
  [ 0.15,  0,     0,     0.13,  0.8,   0,     0   ],
  [ 0.0,   0,     0,     0.2,   0.0,   0.3,   0   ],
  [ 0.0,   0,     0,     0.1,   0.0,   1,     0   ], // 12
  [ 0.3,   0,     0,     0.1,   1,     0,     0   ],
  [ 0,     0,     0.0,   0.1,   0.35,  0,     0.3 ],
  [ 0.3,   0,     0,     0.13,   0.8,   0,     0  ],
];

let t2lUpperBound = [
  [ 0,     0,     0,     0,     0,     0,     0   ], // 0
  [ 0,     0,     0,     0,     0,     0,     0   ], 
  [ 0.1,   0.15,  0,     0.6,   0,     0,     0   ],
  [ 0.0,   0.13,  0,     0.3,   0.2,   0,     0   ],
  [ 0,     0.08,  0,     0.2,   0.6,   0.6,   0.2 ], // 4
  [ 0.45,  0.15,  0.15,  0.6,   0,     0,     0   ],
  [ 0.85,  0.3,   0.3,   0.3,   0,     0,     0   ],
  [ 0.0,   0.15,  0,     0.4,   1,     0,     0.5 ],
  [ 0,     1,     1,     0.0,   0,     0,     0   ], // 8
  [ 0,     0.0,   1,     0.4,   0,     0,     0   ],
  [ 0.15,  0,     0,     0.13,  0.8,   0,     0   ],
  [ 0.0,   0,     0,     0.4,   0.0,   0.3,   0   ],
  [ 0.1,   0,     0,     0.2,   0.0,   1,     0   ], // 12
  [ 0.3,   0,     0,     0.22,  1,     0,     0   ],
  [ 0,     0,     0.0,   0.4,   0.55,  0,     0.8 ],
  [ 0.3,   0,     0,     0.13,  0.8,   0,     0   ],
];

// coarticulation weights for each phoneme. 0= no modification to phoneme, 1=use phonemes arround to build viseme
let t2lCoarts = [
  [ 0,     0,     0,     0,     0,     0,     0   ], // 0
  [ 0.6,   0.6,   0.6,   0.6,   0.6,   0.6,   0.6 ],
  [ 0.2,   0.3,   0.3,   0.3,   0.1,   0.3,   0.5 ],
  [ 0.0,   0.3,   0.3,   0.3,   0.1,   0.3,   0.5 ],
  [ 0.1,   0.3,   0.3,   0.3,   0,     0,     0.5 ], // 4
  [ 0.2,   0.3,   0.3,   0.3,   0.3,   0.3,   0.5 ],
  [ 0.2,   0.3,   0.3,   0.3,   0.3,   0.3,   0.5 ],
  [ 1,     0.4,   0.4,   0.9,   0,     0.5,   0.5 ],
  [ 1,     0,     0,     0.0,   1,     0.8,   0.5 ], //8 
  [ 1,     0,     0,     0.2,   1,     0.5,   0.5 ],
  [ 1,     0.6,   0.6,   0.6,   0,     0.5,   0.5 ],
  [ 1,     1,     1,     0.7,   0.5,   0.5,   0.5 ],
  [ 0.7,   0.5,   0.5,   0.9,   0.6,   0,     0.5 ], //12
  [ 1,     1,     1,     0.5,   0,     0,     0.5 ],
  [ 1,     0.3,   0.3,   0.3,   0,     0.6,   0   ], 
  [ 0.5,   0.3,   0.3,   0.5,  0,     0,     0    ],

];

let t2lPh2v = {
    ".": 0, "_": 1, " ": 1,
    "a": 2,//"AA"	 
    "@": 2,//"AE"	 
    "A": 2,//"AH"	 
    "c": 5,//"AO"	 
    "W": 2,//"AW"	 
    "x": 2,//"AX"	 
    "Y": 2,//"AY"	 
    "E": 3,//"EH"	 
    "R": 3,//"ER"	 
    "e": 3,//"EY"	 
    "I": 4,//"IH"	 
    "X": 4,//"IX"	 
    "i": 4,//"IY"	 
    "o": 5,//"OW"	 
    "O": 5,//"OY"	 
    "U": 6,//"UH"	 
    "u": 6,//"UW"	 

    "b": 8,//"B"	
    "C": 15,//"CH"	 // ------------------------ Really needs a new viseme - 'SH'
    "d": 13,//"D"	
    "D": 13,//"DH"	
    "F": 13,//"DX"	
    "L": 7,//"EL"	
    "M": 8,//"EM"	
    "N": 7,//"EN"	
    "f": 9,//"F"	
    "g": 12,//"G"	
    "h": 11,//"H"	// reduced
    "J": 15,//"JH"	 // ------------------------- Really needs a new viseme 'ZH'
    "k": 12,//"K"	
    "l": 7,//"L"	
    "m": 8,//"M"	
    "n": 7,//"N"	
    "G": 12,//"NG"	// reduced
    "p": 8,//"P"	
    "Q": 2,//"Q"	 // -------------------------- What is this?
    "r": 7,//"R"	
    "s": 10,//"S"	
    "S": 15,//"SH"	 // ------------------------ Really needs a new viseme - 'CH'
    "t": 13,//"T"	
    "T": 14,//"TH"	
    "v": 9,//"V"	
    "w": 6,//"W"	
    "H": 6,//"WH"	
    "y": 4,//"Y"	
    "z": 10,//"Z"	
    "Z": 10,//"ZH"	 // ------------------------- Really needs a new viseme 'JH'
};

let T2LTABLES = {
    BlendshapeMapping: { kiss: 0, upperLipClosed: 1, lowerLipClosed: 2, jawOpen: 3, tongueFrontUp: 4, tongueBackUp: 5, tongueOut: 6 },
    LowerBound: t2lLowerBound,
    UpperBound: t2lUpperBound,
    Coarticulations: t2lCoarts,
    PhonemeToViseme : t2lPh2v,
}

/* ANIMATION */
AnimationManager.prototype.animations = {
    "IDLE": "evalls/projects/animations/animations_idle.wbin",
    "WAVE": "evalls/projects/animations/animations_waving.wbin",
    "NO": "evalls/projects/animations/animations_no.wbin",
    "BORED": "evalls/projects/animations/animations_bored.wbin",
    "ANGRY": "evalls/projects/animations/animations_angry.wbin",
    "HAPPY": "evalls/projects/animations/animations_happy.wbin",
    "PRAYING": "evalls/projects/animations/animations_praying.wbin",
    "CRAZY": "evalls/projects/animations/animations_crazy.wbin"
}

function AnimationManager(component, animations) {

    this.animManager = component;

    // Animations
    this.animations = animations || this.animations;
    this.playing = false;
}

// animationData with animationID, sync attr, speed
AnimationManager.prototype.newAnimation = function (animationData, animations) {
    
    this.currentAnim = {
        speed: this.animManager.playback_speed,
        animation: this.animManager.animation
    }

    this.playing = false;
    // Sync
    this.start = animationData.start || 0.0;
    this.speed = animationData.speed || 1.0;
    this.shift = animationData.shift;
    this.time = 0;
    var url = this.animations[animationData.name];
    this.animationName = url;
    var anim = LS.RM.getResource(this.animationName)

    if (!anim)
        LS.RM.load(this.animationName, null, this.setDuration.bind(this))
    else
        this.setDuration(anim)
}

AnimationManager.prototype.initValues = function () {
    
    this.time = 0;
}

AnimationManager.prototype.setDuration = function (anim) {
    
    this.duration = anim.takes.default.duration;
}

AnimationManager.prototype.update = function (dt) {

    if (this.time == 0)
        this.initValues();
    // Wait for to reach start time

    if (this.time < this.start) {
        return;
    }
    else if (this.time >= this.start && !this.playing) {
        this.animManager.playback_speed = this.speed;
        this.animManager.animation = this.animationName;
        this.playing = true;
    }
    else if (!this.shift && this.time >= this.duration && this.playing) {
        this.animManager.animation = this.currentAnim.animation;
        this.animManager.playback_speed = this.currentAnim.speed;
    }

    this.time += dt;
}

export { Blink, FacialExpr, FacialEmotion, GazeManager, Gaze, HeadBML, Lipsync, Text2LipInterface, T2LTABLES }
