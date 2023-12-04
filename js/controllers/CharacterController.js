//@ECA controller
import { BehaviourPlanner } from '../bml/BehaviourPlanner.js';
import { BehaviourManager } from '../bml/BehaviourManager.js';
import { FacialController } from './FacialController.js';
import { BodyController } from '../sigml/BodyController.js';
import { findIndexOfBoneByName } from "../sigml/Utils.js";

//States
CharacterController.prototype.WAITING = 0;
CharacterController.prototype.PROCESSING = 1;
CharacterController.prototype.SPEAKING = 2;
CharacterController.prototype.LISTENING = 3;

window.SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;

function CharacterController(o) {

    this.time = 0;
    this.character = o.character;
    this.characterConfig = o.characterConfig;
    
    // get skeleton
    this.skeleton = null;
    this.character.traverse( ob => {
        if ( ob.isSkinnedMesh ) { this.skeleton = ob.skeleton; }
    } );
    o.skeleton = this.skeleton;

    /** BoneMap */
    // config has a generic name to bone name map. Transform it into a mapping of generic name to bone index (in skeleton). 
    for ( let p in this.characterConfig.boneMap ){
        this.characterConfig.boneMap[ p ] = findIndexOfBoneByName( this.skeleton, this.characterConfig.boneMap[ p ] );            
    }
    
    if (typeof BehaviourManager !== 'undefined') {
        this.BehaviourManager = new BehaviourManager();
    }else {
        console.error("Manager not included");
    }

    if (typeof BehaviourPlanner !== 'undefined') {
        this.BehaviourPlanner = new BehaviourPlanner();
        this.BehaviourPlanner.BehaviourManager = this.BehaviourManager;
    } else {
        console.error("Planner not included");
    }

    if (typeof FacialController !== 'undefined') {
        this.facialController = new FacialController(o);
    } else {
        console.error("FacialController module not found");
    }

    if ( typeof(BodyController) !== 'undefined'){ 
        this.bodyController = new BodyController( this.character, this.skeleton, this.characterConfig );
    } 
}

CharacterController.prototype.start = function () {
    this.pendingResources = [];

    if ( this.facialController ){ this.facialController.start(); }
}

CharacterController.prototype.reset = function ( keepEmotion = false ) {
    this.pendingResources.length = 0;

    if ( this.facialController ){ this.facialController.reset( keepEmotion ); }

    if (this.BehaviourPlanner){ this.BehaviourPlanner.reset(); }

    if (this.BehaviourManager){ this.BehaviourManager.reset(); }

    if (this.bodyController){ this.bodyController.reset(); }

    this.endSpeakingTime = -1;
    this.speaking = false;

}

CharacterController.prototype.update = function (dt, et) {
    let newBlock = null;
    this.time = et;

    if ( this.facialController ){ this.facialController.update(dt); }

    if (this.bodyController){ this.bodyController.update(dt) }

    if (this.BehaviourPlanner){ newBlock = this.BehaviourPlanner.update(dt); }

    if (this.BehaviourManager){ this.BehaviourManager.update(this.processBML.bind(this), et); }

    if ( newBlock ){ this.BehaviourManager.newBlock(newBlock, et); }

    // lipsync stuff????
    if ( this.facialController ){
        if (this.BehaviourManager.lgStack.length && this.BehaviourManager.time <= this.BehaviourManager.lgStack[this.BehaviourManager.lgStack.length - 1].endGlobalTime) {
            this.endSpeakingTime = this.BehaviourManager.lgStack[this.BehaviourManager.lgStack.length - 1].endGlobalTime + 1
            this.speaking = true;
        }
        else if (this.endSpeakingTime > -1 && this.BehaviourManager.time <= this.endSpeakingTime || this.facialController.lipsyncModule.working) {
            this.speaking = true;
        }
        else {
            this.endSpeakingTime = -1;
            this.speaking = false;
        }
    }

}

// Process message
// Messages can come from inner processes. "fromWS" indicates if a reply to the server is required in BMLManager.js
CharacterController.prototype.processMsg = function (data, fromWS) {

    // Update to remove aborted blocks
    if (!this.BehaviourManager)
        return;

    this.BehaviourManager.update(this.processBML.bind(this), this.time);

    // Add new block to stack
    //this.BehaviourManager.newBlock(msg, thiscene.time);
    if(typeof(data) == "string"){ data = JSON.parse(data); }
    if (data.type == "behaviours"){ data = data.data; }

    // Add new blocks to stack
    let msg = {};

    if (data.constructor == Array) {
        // start and end times of whole message
        let end = -1000000;
        let start = 1000000;

        for (let i = 0; i < data.length; i++) {

            if (data[i].type == "info")
                continue;

            // data based on duration. Fix timings from increments to timestamps
            if (!data[i].end && data[i].duration) {
                data[i].end = data[i].start + data[i].duration;
                if (data[i].attackPeak) data[i].attackPeak += data[i].start;
                if (data[i].ready) data[i].ready += data[i].start;
                if (data[i].strokeStart) data[i].strokeStart += data[i].start;
                if (data[i].stroke) data[i].stroke += data[i].start;
                if (data[i].strokeEnd) data[i].strokeEnd += data[i].start;
                if (data[i].relax) data[i].relax += data[i].start;
            }

            // include data of type into msg
            if (!msg[data[i].type]) {
                msg[data[i].type] = [];
            }
            msg[data[i].type].push(data[i]);

            // update start-end of msg
            if (data[i].end > end) end = data[i].end;
            if (data[i].start < start) start = data[i].start;
        }

        msg.start = start;
        msg.end = end;

        if (!msg.composition)
            msg.composition = "MERGE";

        if ( msg.speech && ( msg.speech.constructor == Object || msg.speech.length ) ) {
            msg.control = this.SPEAKING;
        }

        // Process block
        // manages transitions if necessary
        if (this.BehaviourPlanner) {
            this.BehaviourPlanner.newBlock(msg);
        }
        // add blocks to stacks
        this.BehaviourManager.newBlock(msg, this.time);
    }

    else if (data.constructor == Object) {
        msg = data;
        if ( (data.type == "state" || data.type == "control") && data.parameters) {
            msg.control = this[data.parameters.state.toUpperCase()];
        }
        else if (data.type == "info")
            return;

        if ( msg.speech && ( msg.speech.constructor == Object || msg.speech.length ) ) {
            msg.control = this.SPEAKING;
        }
        // Process block
        // manages transitions if necessary
        if (this.BehaviourPlanner) {
            this.BehaviourPlanner.newBlock(msg);
        }
        // add blocks to stacks
        this.BehaviourManager.newBlock(msg, this.time);
     }

    if (fromWS)
        msg.fromWS = fromWS;

    // Client id -> should be characterId?
    if (msg.clientId && !this.ws.id) {
        this.ws.id = msg.clientId;
        console.log("Client ID: ", msg.clientId);
        return;
    }

    // Load audio files
    if (msg.lg) {
        let hasToLoad = this.loadAudio(msg);
        if (hasToLoad) {
            this.pendingResources.push(msg);
            console.log("Needs to preload audio files.");
            return;
        }
    }

    if (!msg) {
        console.error("An undefined msg has been received.", msg);
        return;
    }

    // Update to remove aborted blocks
    if (!this.BehaviourManager)
        return;

    this.BehaviourManager.update(this.processBML.bind(this), this.time);

    if (!msg) {
        console.error("An undefined block has been created due to the update of BMLManager.", msg);
        return;
    }
}

// Process message
CharacterController.prototype.processBML = function (key, bml) {

    if ( ( !this.facialController && key != "gesture" ) || ( !this.bodyController && key == "gesture" ) )
        return;

    let thatFacial = this.facialController;

    switch (key) {
        case "blink":
            thatFacial.newBlink(bml);
            break;
        case "gaze":
            thatFacial.newGaze(bml, !!bml.shift); // !!shift make it bool (just in case)
            break;
        case "gazeShift":
            thatFacial.newGaze(bml, true);
            break;
        case "head":
            thatFacial.newHeadBML(bml);
            break;
        case "headDirectionShift":
            thatFacial.headDirectionShift(bml);
            break;
        case "face":
            thatFacial.newFA(bml, !!bml.shift); // !!shift make it bool (just in case)
            break;
        case "faceLexeme":
            thatFacial.newFA(bml, !!bml.shift); // !!shift make it bool (just in case)
            break;
        case "faceFACS":
            thatFacial.newFA(bml, false);
            break;
        case "faceEmotion":
            thatFacial.newFA(bml, !!bml.shift); // !!shift make it bool (just in case)
            break;
        case "faceVA":
            thatFacial.newFA(bml, !!bml.shift); // !!shift make it bool (just in case)
            break;
        case "faceShift":
            thatFacial.newFA(bml, true);
            break;
        case "speech":
            if (bml.phT)
                bml.phT = new Float32Array(Object.values(bml.phT));
            thatFacial.newTextToLip(bml);
            break;
        case "gesture":
            this.bodyController.newGesture( bml );
            break;
        case "animation":
            // TODO
            break;
        case "lg":
            thatFacial.newLipsync( bml );
            break;
    }
}

// Preloads audios to avoid loading time when added to BML stacks
CharacterController.prototype.loadAudio = function (block) {
    let output = false;
    if (block.lg.constructor === Array) {
        for (let i = 0; i < block.lg.length; i++) {
        if (!block.lg[i].audio) {
            block.lg[i].audio = new Audio();
            block.lg[i].audio.src = block.lg[i].url;
            output = true;
        }
        }
    }
    else {
        if (!block.lg.audio) {
            block.lg.audio = new Audio();
            block.lg.audio.src = block.lg.url;
            output = true;
        }
    }

    return output;
}
export { CharacterController }