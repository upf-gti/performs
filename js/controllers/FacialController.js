//@FacialController

import { Blink, FacialExpr, FacialEmotion, GazeManager, Gaze, HeadBML, Lipsync, Text2LipInterface, T2LTABLES } from '../bml/BehaviourRealizer.js';
import * as THREE from 'three';

function FacialController(config = null) {
    
    // define some properties
    this._gazePositions = {
        "RIGHT": new THREE.Vector3(-30, 2, 100), "LEFT": new THREE.Vector3(30, 2, 100),
        "UP": new THREE.Vector3(0, 20, 100), "DOWN": new THREE.Vector3(0, -20, 100),
        "UP_RIGHT": new THREE.Vector3(-30, 20, 100), "UP_LEFT": new THREE.Vector3(30, 20, 100),
        "DOWN_RIGHT": new THREE.Vector3(-30, -20, 100), "DOWN_LEFT": new THREE.Vector3(30, -20, 100),
        "FRONT": new THREE.Vector3(0, 2, 100), "CAMERA": new THREE.Vector3(0, 2, 100)
    };

    this._morphTargets = {}; // current avatar morph targets
    this._avatarParts = {}; // list of AU in each mesh of the avatar
    this._boneMap = {}; // bone name to index mapper
    this._mappingAU2BS = {}; // mappings of current (target) avatar BS to default (source) action units
    
    // default action units
    this._actionUnits = {
        "dictionary": {
                "Inner_Brow_Raiser": 0, "Outer_Brow_Raiser_Left": 1, "Outer_Brow_Raiser_Right": 2, "Brow_Lowerer_Left": 3, "Brow_Lowerer_Right": 4, "Nose_Wrinkler_Left": 5, "Nose_Wrinkler_Right": 6, "Nostril_Dilator": 7, "Nostril_Compressor": 8,
                "Dimpler_Left": 9, "Dimpler_Right": 10, "Upper_Lip_Raiser_Left": 11, "Upper_Lip_Raiser_Right": 12, "Lip_Corner_Puller_Left": 13, "Lip_Corner_Puller_Right": 14, "Lip_Corner_Depressor_Left": 15, "Lip_Corner_Depressor_Right": 16,
                "Lower_Lip_Depressor_Left": 17, "Lower_Lip_Depressor_Right": 18, "Lip_Puckerer_Left": 19, "Lip_Puckerer_Right": 20, "Lip_Stretcher_Left": 21, "Lip_Stretcher_Right": 22, "Lip_Funneler": 23, "Lip_Pressor_Left": 24, "Lip_Pressor_Right": 25,
                "Lips_Part": 26, "Lip_Suck_Upper": 27, "Lip_Suck_Lower": 28, "Lip_Wipe": 29, "Tongue_Up": 30, "Tongue_Show": 31, "Tongue_Bulge_Left": 32, "Tongue_Bulge_Right": 33, "Tongue_Wide": 34, "Mouth_Stretch": 35, "Jaw_Drop": 36, "Jaw_Thrust": 37,
                "Jaw_Sideways_Left": 38, "Jaw_Sideways_Right": 39, "Chin_Raiser": 40, "Cheek_Raiser_Left": 41, "Cheek_Raiser_Right": 42, "Cheek_Blow_Left": 43, "Cheek_Blow_Right": 44, "Cheek_Suck_Left": 45, "Cheek_Suck_Right": 46, "Upper_Lid_Raiser_Left": 47,
                "Upper_Lid_Raiser_Right": 48, "Squint_Left": 49, "Squint_Right": 50, "Blink_Left": 51, "Blink_Right": 52, "Wink_Left": 53, "Wink_Right": 54, "Neck_Tightener": 55
            },
        "influences": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    };

    this._eyeLidsAU = [51, 52]; // idx number of eyelids related AU - gaze and blink easy access
    this._squintAU = [49, 50]; // idx number of squint related AU - gaze and blink easy access
    
    // t2l
    this._jali = [0.66, 1.0]; // [jaw, lip]

    // TODO: update a2l names ?
    this.lipsPressedBSName = "Jaw_Up";
    this.lowerLipINBSName = "Lip_Suck_Lower";
    this.lowerLipDownBSName = "Lower_Lip_Depressor_Left";
    this.mouthNarrowBSName = "MouthNarrow";
    this.mouthOpenBSName = "MouthOpen";
    
    this.lipsyncModule = new Lipsync();

    // if we have the state passed, then we restore the state
    if (config)
        this.configure(config);
}


FacialController.prototype.configure = function (o) {

    if (o.character) {
        this.character = o.character;
        this.skeleton = o.skeleton;
    }
    
    if (o.gazePositions) this._gazePositions = o.gazePositions;
    if (o.morphTargets) this._morphTargets = o.morphTargets;

    if(o.characterConfig) {
        this._mappingAU2BS = o.characterConfig.faceController.blendshapeMap;
        this._boneMap = o.characterConfig.boneMap;
        this._avatarParts = o.characterConfig.faceController.parts;
    }
}

FacialController.prototype.start = function ( options ) {

    this._morphTargets = {}; // map "name" of part to its scene obj
    for (const part in this._avatarParts) {
        let obj = this.character.getObjectByName(part);
        if ( !obj || !obj.morphTargetDictionary || !obj.morphTargetInfluences ){
            console.log( "FacialController: \"" + part + "\" object could not be found in the avatar" );
            delete this._avatarParts[ part ];
            continue;
        }
        this._morphTargets[part] = obj;

        if ( !Array.isArray( this._avatarParts[part] ) ){ // if not array of AU provided for this part, use all AUs
            this._avatarParts[part] = Object.keys(this._actionUnits.dictionary);
        }

    }
        
    this._facialAUAcc = this._actionUnits.influences.slice(); // clone array;
    this._facialAUFinal = this._actionUnits.influences.slice(); // clone array;

    if (!this._morphTargets) {
        console.error("Morph deformer not found");
        return;
    }
    
    this.resetFace();

    this._FacialLexemes = [];
    this.FA = new FacialEmotion(this._facialAUFinal);
    
    // Gaze
    // Get head bone node
    if (!this._boneMap.Head)
    console.error("Head bone node not found with id: ");
    else if (!this._gazePositions["HEAD"]) {
        let headNode = this.skeleton.bones[this._boneMap.Head];
        this._gazePositions["HEAD"] = headNode.getWorldPosition(new THREE.Vector3());
    }

    // Get lookAt nodes  
    let lookAtEyesNode = this.character.eyesTarget;
    let lookAtNeckNode = this.character.neckTarget;
    let lookAtHeadNode = this.character.headTarget;

    if (!this._gazePositions["EYESTARGET"]){ this._gazePositions["EYESTARGET"] = lookAtEyesNode.getWorldPosition(new THREE.Vector3()); }
    if (!this._gazePositions["HEADTARGET"]){ this._gazePositions["HEADTARGET"] = lookAtHeadNode.getWorldPosition(new THREE.Vector3()); }
    if (!this._gazePositions["NECKTARGET"]){ this._gazePositions["NECKTARGET"] = lookAtNeckNode.getWorldPosition(new THREE.Vector3()); }

    // Gaze manager
    this.gazeManager = new GazeManager(lookAtNeckNode, lookAtHeadNode, lookAtEyesNode, this._gazePositions);

    this.headBML = []; //null;

    this.autoBlink = new Blink( false );
    this.autoBlink.setAuto( ( options && options.hasOwnProperty( "autoBlink" ) ) ? options.autoBlink : true );
}

FacialController.prototype.reset = function ( keepEmotion = false ) {
    
    this.resetFace(); // blendshapes to 0
    
    if ( this.textToLip ) { this.textToLip.cleanQueueSentences( true ); }
    if ( this.lipsyncModule ) { this.lipsyncModule.stop(); }

    this._FacialLexemes.length = 0;
    if ( !keepEmotion ){ this.FA.reset(); } 

    this.gazeManager.reset();
    this.headBML.length = 0;

    if( this.blink ){ this.blink.reset(); }
}

FacialController.prototype.resetFace = function () {
    for (let i = 0; i < this._facialAUFinal.length; i++) {
        this._facialAUAcc[i] = 0;
        this._facialAUFinal[i] = 0;
        this._actionUnits.influences[i] = 0;
    }
}

/**  public update function (update inner BS and map them to current avatar) */ 
FacialController.prototype.update = function (dt) {

    // Update Facial BlendShapes
    this.innerUpdate(dt);

    // Map facialBS to current model BS
    let targetAccumulatedValues = {}; // store multiple value for each target
    
    for (let AUName in this._mappingAU2BS) {
        let avatarBSnames = this._mappingAU2BS[AUName]; // array of target avatar BS [names, factor]
        
        let idx = this._actionUnits.dictionary[AUName]; // index of source blendshape
        let value = this._actionUnits.influences[idx]; // value of source blendshape
        
        // map source value to all target BS
        for (let i = 0; i < avatarBSnames.length; i++) {
            let targetBSName = avatarBSnames[i][0];
            let targetBSFactor = avatarBSnames[i][1];
            
            if (!targetAccumulatedValues[targetBSName]) { targetAccumulatedValues[targetBSName] = []; }
            targetAccumulatedValues[targetBSName].push(value * targetBSFactor); // store the value in the array for this target
        }
    }
    
    // compute the mean influence value for each target
    for (let part in this._avatarParts) {
        // get AU names that influence current mesh (if null uses all AUs)
        let AUnames = this._avatarParts[part] ? this._avatarParts[part] : Object.keys(this._actionUnits.dictionary);
        for (let i = 0; i < AUnames.length; i++) {
            let avatarBSnames = this._mappingAU2BS[AUnames[i]] ? this._mappingAU2BS[AUnames[i]] : [];
            for (let i = 0; i < avatarBSnames.length; i++) {
                let targetBSName = avatarBSnames[i][0];
                let values = targetAccumulatedValues[targetBSName] ? targetAccumulatedValues[targetBSName] : [];
                let meanValue = 0;
                let acc = 0;
                let final = 0;

                // compute biased average
                for (let i = 0; i < values.length; i++) {
                    acc += Math.abs(values[i]);
                    final += values[i] * Math.abs(values[i]);
                }
                if (acc > 0.0001) meanValue = final / acc;
        
                // update the target blendshape with the mean value
                let targetIdx = this._morphTargets[part].morphTargetDictionary[targetBSName];
                if (targetIdx !== undefined) {
                    this._morphTargets[part].morphTargetInfluences[targetIdx] = meanValue;
                }
            }
        }
    }
}
    
//example of one method called for ever update event
FacialController.prototype.innerUpdate = function (dt) {

    // Update facial expression
    this.faceUpdate(dt);

    let lookAtEyes = this.character.eyesTarget.getWorldPosition(new THREE.Vector3());
    let lookAtHead = this.character.headTarget.getWorldPosition(new THREE.Vector3());
    let lookAtNeck = this.character.neckTarget.getWorldPosition(new THREE.Vector3());
    
    this.skeleton.bones[this._boneMap.Neck].lookAt(lookAtNeck);
    this.skeleton.bones[this._boneMap.Head].lookAt(lookAtHead);
    
    // HEAD (nod, shake, tilt, tiltleft, tiltright, forward, backward)
    let headQuat = this.skeleton.bones[this._boneMap.Head].quaternion; // Not a copy, but a reference
    let neckQuat = this.skeleton.bones[this._boneMap.Neck].quaternion; // Not a copy, but a reference
    for( let i = 0; i< this.headBML.length; ++i){
        let head = this.headBML[i];
        if( !head.transition ){
            this.headBML.splice(i,1);
            --i;
            continue;
        }
        head.update(dt);
        if(head.lexeme == "FORWARD" || head.lexeme == "BACKWARD") {
            neckQuat.multiply( head.currentStrokeQuat );
            headQuat.multiply( head.currentStrokeQuat.invert() );
            head.currentStrokeQuat.invert(); // inverting quats is cheap
        } 
        else
            headQuat.multiply( head.currentStrokeQuat );
    }

    this.skeleton.bones[this._boneMap.LEye].lookAt(lookAtEyes);
    this.skeleton.bones[this._boneMap.REye].lookAt(lookAtEyes);
}

// Update facial expressions
FacialController.prototype.faceUpdate = function (dt) {
    
    // reset accumulators for biased average
    this._facialAUAcc.fill(0);
    this._facialAUFinal.fill(0);
    
    // Text to lip
    if (this.textToLip && this.textToLip.getCompactState() == 0) { // when getCompactState==0 lipsync is working, not paused and has sentences to process
        this.textToLip.update(dt);
        let t2lBSW = this.textToLip.getBSW(); // reference, not a copy
        
        // textToLipBSMapping = [ [], [] ] --> [jaw, lip]
        for (let i = 0; i < this.textToLipBSMapping.length; i++) { // jaw or lip
            for (let j = 0; j < this.textToLipBSMapping[i].length; j++) {
                let mapping = this.textToLipBSMapping[i][j]; // [ MeshBSIndex, T2Lindex ]
                let value = this._jali[i] * Math.min(1, Math.max(-1, t2lBSW[i][mapping[1]]));
                let index = mapping[0];
                // for this model, some blendshapes need to be negative
                this._facialAUAcc[index] += Math.abs(value); // denominator of biased average
                this._facialAUFinal[index] += value * Math.abs(value); // numerator of biased average
            }
        }
    }

    // lipsync
    if (this.lipsyncModule && this.lipsyncModule.working) // audio to lip
    {
        this.lipsyncModule.update(dt);
        let facialLexemes = this.lipsyncModule.BSW;
        if (facialLexemes) {

            let smooth = 0.66;
            let BSAcc = this._facialAUAcc;
            let BSFin = this._facialAUFinal;
            let BS = this._actionUnits.influences; // for smoothing purposes
            let morphDict = this._actionUnits.dictionary;
            // search every morphTarget to find the proper ones
            let names = Object.keys(morphDict);
            for (let i = 0; i < names.length; i++) {

                let name = names[i];
                let bsIdx = morphDict[name];
                let value = 0;
                if (name.includes(this.mouthOpenBSName))
                    value = (1 - smooth) * BS[bsIdx] + smooth * facialLexemes[2];

                if (name.includes(this.lowerLipINBSName))
                    value = (1 - smooth) * BS[bsIdx] + smooth * facialLexemes[1];

                if (name.includes(this.lowerLipDownBSName))
                    value = (1 - smooth) * BS[bsIdx] + smooth * facialLexemes[1];

                if (name.includes(this.mouthNarrowBSName))
                    value = (1 - smooth) * BS[bsIdx] + smooth * facialLexemes[0] * 0.5;

                if (name.includes(this.lipsPressedBSName))
                    value = (1 - smooth) * BS[bsIdx] + smooth * facialLexemes[1];

                BSAcc[bsIdx] += Math.abs(value); // denominator of biased average
                BSFin[bsIdx] += value * Math.abs(value); // numerator of biased average

            }
        }
    }

    //FacialEmotion ValAro/Emotions
    this.FA.updateVABSW(dt);

    for (let j = 0; j < this.FA.currentVABSW.length; j++) {
        let value = this.FA.currentVABSW[j];
        this._facialAUAcc[j] += Math.abs(value); // denominator of biased average
        this._facialAUFinal[j] += value * Math.abs(value); // numerator of biased average
    }

    // FacialExpr lexemes
    for (let k = 0; k < this._FacialLexemes.length; k++) {
        let lexeme = this._FacialLexemes[k];
        if (lexeme.transition) {
            lexeme.updateLexemesBSW(dt);
            // accumulate blendshape values
            for (let i = 0; i < lexeme.indicesLex.length; i++) {
                for (let j = 0; j < lexeme.indicesLex[i].length; j++) {
                    let value = lexeme.currentLexBSW[i][j];
                    let index = lexeme.indicesLex[i][j];
                    this._facialAUAcc[index] += Math.abs(value); // denominator of biased average
                    this._facialAUFinal[index] += value * Math.abs(value); // numerator of biased average
                }
            }
        }

        // remove lexeme if finished
        if (!lexeme.transition) {
            this._FacialLexemes.splice(k, 1);
            --k;
        }
    }

    // Gaze
    if (this.gazeManager){
        let weights = this.gazeManager.update(dt);

        // eyelids update
        for(let i = 0; i< this._eyeLidsAU.length; i++){         
            this._facialAUAcc[ this._eyeLidsAU[i] ] += Math.abs(weights.eyelids);
            this._facialAUFinal[ this._eyeLidsAU[i] ] += weights.eyelids * Math.abs(weights.eyelids);
        }
        // squint update
        for(let i = 0; i< this._squintAU.length; i++){         
            this._facialAUAcc[ this._squintAU[i] ] += Math.abs(weights.squint);
            this._facialAUFinal[ this._squintAU[i] ] += weights.squint * Math.abs(weights.squint);
        }
    }


    // Second pass, compute mean (division)
    // result = ( val1 * |val1|/|sumVals| ) + ( val2 * |val2|/|sumVals| ) + ...
    // copy blendshape arrays back to real arrays and compute biased average  
    let target = this._facialAUFinal;
    let numerator = this._facialAUFinal;
    let acc = this._facialAUAcc;
    for (let i = 0; i < target.length; ++i) {
        if (acc[i] < 0.0001) { target[i] = 0; }
        else { target[i] = numerator[i] / acc[i]; }
    }

    // --- UPDATE POST BIASED AVERAGE --- 
    // this._facialAUFinal has all the valid values

    // Eye blink
    if ( this.autoBlink.state ) {
        this.autoBlink.update(dt, this._facialAUFinal[this._eyeLidsAU[0]], this._facialAUFinal[this._eyeLidsAU[1]]);
        this._facialAUFinal[this._eyeLidsAU[0]] = this.autoBlink.weights[0];
        this._facialAUFinal[this._eyeLidsAU[1]] = this.autoBlink.weights[1];
    }

    // "Render" final facial (body) blendshapes
    // copy blendshape arrays back to real arrays
    let tar = this._actionUnits.influences;
    let source = this._facialAUFinal;
    for (let i = 0; i < tar.length; ++i) {
        tar[i] = source[i];
    }

}


// ----------------------- TEXT TO LIP --------------------
// Create a Text to Lip mouthing
FacialController.prototype.newTextToLip = function (bml) {
    
    if (!this.textToLip) { // setup

        this.textToLip = new Text2LipInterface();
        this.textToLip.start(); // keep started but idle
        this.textToLipBSMapping = [ [], [] ]; // [jaw, lip] array of [ MeshBSIndex, T2Lindex ]

        let t2lBSWMap = T2LTABLES.BlendshapeMapping; // [ {auName: 0, ...}, ]
                
        // map blendshapes to text2lip output
        for (let i = 0; i < t2lBSWMap.length; i++) {
            for (const auName in t2lBSWMap[i]) {   
                let idx = this._actionUnits.dictionary[ auName ];
                if (idx) this.textToLipBSMapping[i].push([ idx, t2lBSWMap[i][auName] ]);
            }
        }
    
    }

    let text = bml.text;
    if ( text[ text.length - 1 ] != "." ){ text += "."; } 
    this.textToLip.cleanQueueSentences();
    this.textToLip.pushSentence(bml.text, bml); // use info object as options container also  
}


// --------------------- lipsync --------------------------------
// Create a Text to Lip mouthing
FacialController.prototype.newLipsync = function (bml) {
    
    if (!this.lipsyncModule)
        return;

    if (bml.audio)
        this.lipsyncModule.loadBlob(bml.audio);
    else if (bml.url)
        this.lipsyncModule.loadSample(bml.url);
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
// face/faceShift can contain several sons of type faceLexeme without sync attr
// valaro Range [-1, 1]

// TODO: THIS CAUSES PROBLEMS????
// Declare new facial expression
FacialController.prototype.newFA = function (faceData, shift) {
    
    // Use BSW of the agent
    for (let i = 0; i < this._facialAUFinal.length; i++) {
        this._facialAUFinal[i] = this._actionUnits.influences[i];
    }
    if (faceData.emotion || faceData.valaro) {
        this.FA.initFaceValAro(faceData, shift, this._facialAUFinal); // new FacialExpr (faceData, shift, this._facialAUFinal);
    }
    else if (faceData.lexeme) {
        this._FacialLexemes.push(new FacialExpr(faceData, shift, this._facialAUFinal));
    }

}

// --------------------- BLINK ---------------------
FacialController.prototype.newBlink = function ( bml ){
    this.autoBlink.blink();
}

// --------------------- GAZE ---------------------
// BML
// <gaze or gazeShift start ready* relax* end influence target influence offsetAngle offsetDirection>
// influence [EYES, HEAD, NECK, SHOULDER, WAIST, WHOLE, ...]
// offsetAngle relative to target
// offsetDirection (of offsetAngle) [RIGHT, LEFT, UP, DOWN, UP_RIGHT, UP_LEFT, DOWN_LEFT, DOWN_RIGHT]
// target [CAMERA, RIGHT, LEFT, UP, DOWN, UP_RIGHT, UP_LEFT, DOWN_LEFT, DOWN_RIGHT]

// "HEAD" position is added on Start

FacialController.prototype.newGaze = function (gazeData, shift, gazePositions = null) {

    // TODO: recicle gaze in gazeManager
    let blinkW = this._facialAUFinal[0]
    let eyelidsW = this._facialAUFinal[this._eyeLidsAU[0]]
    let squintW = this._facialAUFinal[this._squintAU[0]]
    gazeData.eyelidsWeight = eyelidsW;
    gazeData.squintWeight = squintW;
    gazeData.blinkWeight = blinkW;

    this.gazeManager.newGaze(gazeData, shift, gazePositions, !!gazeData.headOnly);

}

// BML
// <headDirectionShift start end target>
// Uses gazeBML
FacialController.prototype.headDirectionShift = function (headData, cmdId) {
    
    headData.end = headData.end || 2.0;
    headData.influence = "HEAD";
    this.newGaze(headData, true, null, true);
}

// --------------------- HEAD ---------------------
// BML
// <head start ready strokeStart stroke strokeEnd relax end lexeme repetition amount>
// lexeme [NOD, SHAKE, TILT, TILT_LEFT, TILT_RIGHT, FORWARD, BACKWARD]
// repetition cancels stroke attr
// amount how intense is the head nod? 0 to 1
// New head behavior
FacialController.prototype.newHeadBML = function (headData) {
    
    // work with indexes instead of names
    let node = headData.lexeme == "FORWARD" || headData.lexeme == "BACKWARD" ? this._boneMap.Neck : this._boneMap.Head;
    let bone = this.skeleton.bones[node]; // let bone = this.character.getObjectByName(node);
    if (bone) {
        this.headBML.push(new HeadBML(headData, bone, bone.quaternion.clone()));
    }
}


export { FacialController }