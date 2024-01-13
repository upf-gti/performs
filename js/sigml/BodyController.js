import * as THREE from "three";

import { LocationBodyArm } from "./LocationBodyArm.js";
import { HandShape } from "./HandShape.js"
import { ExtfidirPalmor } from "./ExtfidirPalmor.js";
import { CircularMotion, DirectedMotion, FingerPlay, WristMotion } from "./Motion.js";
import { HandConstellation } from "./HandConstellation.js";
import { ElbowRaise, ShoulderRaise, ShoulderHunch, BodyMovement } from "./ElbowShouldersBodyNMF.js";

import { findIndexOfBoneByName, forceBindPoseQuats, getTwistQuaternion, nlerpQuats } from "./Utils.js";
import { GeometricArmIK } from "./GeometricArmIK.js";

// characterConfig is modified by bodyController
class BodyController{
    
    constructor( character, skeleton, characterConfig ){
        this.character = character;
        this.skeleton = skeleton;
        this.computeConfig( characterConfig );

        // -------------- All modules --------------
        forceBindPoseQuats( this.skeleton, true ); // so all modules can setup things in bind pose already
        this.character.updateWorldMatrix( true, true );
        this.right = this._createArm( false );
        this.left = this._createArm( true );
        this.handConstellation = new HandConstellation( this.config.boneMap, this.skeleton, this.config.handLocationsR, this.config.handLocationsL );
        this.bodyMovement = new BodyMovement( this.config, this.skeleton );

        this.dominant = this.right;
        this.nonDominant = this.left;

        this._tempQ_0 = new THREE.Quaternion();
        this._tempQ_1 = new THREE.Quaternion();
        this._tempV3_0 = new THREE.Vector3();
        this._tempV3_1 = new THREE.Vector3();

        this.foreArmFactor = 0.6;
    }

    computeConfig( jsonConfig ){
        // reference, not a copy. All changes also affect the incoming characterConfig
        this.config = jsonConfig.bodyController; 

        this.config.boneMap = jsonConfig.boneMap; // reference, not a copy

        /** Main Avatar Axes in Mesh Coordinates */
        if ( this.config.axes ){ 
            for( let i = 0; i < this.config.axes.length; ++i ){ // probably axes are a simple js object {x:0,y:0,z:0}. Convert it to threejs
                this.config.axes[i] = new THREE.Vector3(  this.config.axes[i].x, this.config.axes[i].y, this.config.axes[i].z ); 
            }
        } else{ 
            // compute axes in MESH coordinates using the the Bind pose ( TPose mandatory )
            // MESH coordinates: the same in which the actual vertices are located, without any rigging or any matrix applied
            this.config.axes = [ new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3() ]; // x,y,z
            let boneMap = this.config.boneMap;
            this.skeleton.bones[ boneMap.Hips ].updateWorldMatrix( true, true ); // parents and children also
    
            let a = (new THREE.Vector3()).setFromMatrixPosition( this.skeleton.boneInverses[ boneMap.LShoulder ].clone().invert() );
            let b = (new THREE.Vector3()).setFromMatrixPosition( this.skeleton.boneInverses[ boneMap.RShoulder ].clone().invert() );
            this.config.axes[0].subVectors( a, b ).normalize(); // x
    
            a = a.setFromMatrixPosition( this.skeleton.boneInverses[ boneMap.BelowStomach ].clone().invert() );
            b = b.setFromMatrixPosition( this.skeleton.boneInverses[ boneMap.Hips ].clone().invert() );
            this.config.axes[1].subVectors( a, b ).normalize(); // y
            
            this.config.axes[2].crossVectors( this.config.axes[0], this.config.axes[1] ).normalize(); // z = cross( x, y )
            this.config.axes[1].crossVectors( this.config.axes[2], this.config.axes[0] ).normalize(); // y = cross( z, x )
        }

        /** Body and Hand Locations */
        // create location point objects and attach them to bones
        function locationToObjects( table, skeleton, symmetry = false ){
            let result = {};
            for( let name in table ){
                let l = table[ name ];
                
                let idx = findIndexOfBoneByName( skeleton, symmetry ? l[0].replace( "Right", "Left" ) : l[0] );
                if ( idx < 0 ){ continue; }
                
                let o = new THREE.Object3D();
                // let o = new THREE.Mesh( new THREE.SphereGeometry(0.3,16,16), new THREE.MeshStandardMaterial( { color: Math.random()*0xffffff }) );
                o.position.copy( l[1] ).applyMatrix4( skeleton.boneInverses[ idx ] ); // from mesh space to bone local space
                
                // check direction of distance vector 
                if ( l[2] ){
                    let m3 = new THREE.Matrix3();
                    m3.setFromMatrix4( skeleton.boneInverses[ idx ] );
                    o.direction = (new THREE.Vector3()).copy( l[2] ).applyMatrix3( m3 );
                }
                // o.position.copy( l[1] );
                // if ( symmetry ){ o.position.x *= -1; }
                o.name = name;
                skeleton.bones[ idx ].add( o );
                result[ name ] = o;
            }
            return result;   
        }
        this.config.bodyLocations = locationToObjects( this.config.bodyLocations, this.skeleton, false );
        this.config.handLocationsL = locationToObjects( this.config.handLocationsL ? this.config.handLocationsL : this.config.handLocationsR, this.skeleton, !this.config.handLocationsL ); // assume symmetric mesh/skeleton
        this.config.handLocationsR = locationToObjects( this.config.handLocationsR, this.skeleton, false ); // since this.config is being overwrite, generate left before right

        /** default elbow raise, shoulder raise, shoulder hunch */
        let correctedDefaultAngles = {
            elbowRaise: 0,
            shoulderRaise: [ 0, -5 * Math.PI/180, 45 * Math.PI/180 ], // always present angle, min angle, max angle
            shoulderHunch: [ 0, -10 * Math.PI/180, 55 * Math.PI/180 ], // always present angle, min angle, max angle
        }
        if ( typeof( this.config.elbowRaise ) == "number" ){ correctedDefaultAngles.elbowRaise = this.config.elbowRaise * Math.PI/180; }
        if ( Array.isArray( this.config.shoulderRaise ) ){ 
            for( let i = 0; i < 3 && i < this.config.shoulderRaise.length; ++i ){ 
                correctedDefaultAngles.shoulderRaise[i] = this.config.shoulderRaise[i] * Math.PI/180; 
            } 
            if ( correctedDefaultAngles.shoulderRaise[1] > 0 ){ correctedDefaultAngles.shoulderRaise[1] = 0; }
            if ( correctedDefaultAngles.shoulderRaise[2] < 0 ){ correctedDefaultAngles.shoulderRaise[2] = 0; }
        }
        if ( Array.isArray( this.config.shoulderHunch ) ){ 
            for( let i = 0; i < 3 && i < this.config.shoulderHunch.length; ++i ){ 
                correctedDefaultAngles.shoulderHunch[i] = this.config.shoulderHunch[i] * Math.PI/180; 
            } 
            if ( correctedDefaultAngles.shoulderHunch[1] > 0 ){ correctedDefaultAngles.shoulderHunch[1] = 0; }
            if ( correctedDefaultAngles.shoulderHunch[2] < 0 ){ correctedDefaultAngles.shoulderHunch[2] = 0; }
        }
        this.config.elbowRaise = correctedDefaultAngles.elbowRaise;
        this.config.shoulderRaise = correctedDefaultAngles.shoulderRaise;
        this.config.shoulderHunch = correctedDefaultAngles.shoulderHunch;

        /** finger angle ranges */
        let angleRanges = [ // in case of config...
            [ [ 0, 45*Math.PI/180 ] ],//[ [ 0, Math.PI * 0.2 ], [ 0, Math.PI * 0.5 ], [ 0, Math.PI * 0.4 ], [ 0, Math.PI * 0.4 ] ],  // [ splay, base, mid, high ]
            [ [ 0, 20*Math.PI/180 ], [ 0, Math.PI * 0.5 ], [ 0, Math.PI * 0.6 ], [ 0, Math.PI * 0.5 ] ], // [ splay, base, mid, high ]
            [ [ 0, 20*Math.PI/180 ], [ 0, Math.PI * 0.5 ], [ 0, Math.PI * 0.6 ], [ 0, Math.PI * 0.5 ] ], // [ splay, base, mid, high ]
            [ [ 0, 20*Math.PI/180 ], [ 0, Math.PI * 0.5 ], [ 0, Math.PI * 0.6 ], [ 0, Math.PI * 0.5 ] ], // [ splay, base, mid, high ]
            [ [ 0, 20*Math.PI/180 ], [ 0, Math.PI * 0.5 ], [ 0, Math.PI * 0.6 ], [ 0, Math.PI * 0.5 ] ], // [ splay, base, mid, high ]
        ];
        if ( Array.isArray( this.config.fingerAngleRanges ) ){
            let userAngleRanges = this.config.fingerAngleRanges;
            for( let i = 0; i < angleRanges.length && i < userAngleRanges.length; ++i ){ // for each finger available
                let fingerRanges = angleRanges[i];
                let userFingerRanges = userAngleRanges[i]
                if( !Array.isArray( userFingerRanges ) ){ continue; }
                for( let j = 0; j < fingerRanges.length && j < userFingerRanges.length; ++j ){ // for each range in the finger available
                    let range = fingerRanges[j];
                    let userRange = userFingerRanges[j];
                    if ( !Array.isArray( userRange ) || userRange.length < 2 ){ continue; }
                    let v = userRange[0] * Math.PI / 180; 
                    range[0] = isNaN( v ) ? range[0] : v; 
                    v = userRange[1] * Math.PI / 180; 
                    range[1] = isNaN( v ) ? range[1] : v; 
                }
            }
        }
        this.config.fingerAngleRanges = angleRanges;


    }
    _createArm( isLeftHand = false ){
        return {
            loc: new LocationBodyArm( this.config, this.skeleton, isLeftHand ),
            locMotions: [],
            extfidirPalmor: new ExtfidirPalmor( this.config, this.skeleton, isLeftHand ),
            wristMotion: new WristMotion( this.config, this.skeleton, isLeftHand ),
            handshape: new HandShape( this.config, this.skeleton, isLeftHand ),
            fingerplay: new FingerPlay(),
            elbowRaise: new ElbowRaise( this.config, this.skeleton, isLeftHand ),
            shoulderRaise: new ShoulderRaise( this.config, this.skeleton, isLeftHand ),
            shoulderHunch: new ShoulderHunch( this.config, this.skeleton, isLeftHand ),

            needsUpdate: false,
            ikSolver: new GeometricArmIK( this.skeleton, this.config, isLeftHand ),
            locUpdatePoint: new THREE.Vector3(0,0,0),
            _tempWristQuat: new THREE.Quaternion(0,0,0,1), // stores computed extfidir + palmor before any arm movement applied. Necessary for locBody + handConstellation

        };
    }

    _resetArm( arm ){
        arm.loc.reset();
        arm.locMotions = [];
        arm.wristMotion.reset();
        arm.handshape.reset();
        arm.fingerplay.reset();
        arm.elbowRaise.reset();
        arm.shoulderRaise.reset();
        arm.shoulderHunch.reset();
        arm.locUpdatePoint.set(0,0,0);
        arm.needsUpdate = false;

        arm.extfidirPalmor.reset();

    }
    
    reset(){

        this.bodyMovement.reset();
        this.handConstellation.reset();
        this._resetArm( this.right );
        this._resetArm( this.left );

        // this posture setting is quite hacky. To avoid dealing with handConstellation shift (not trivial)
        this.newGesture( { type: "gesture", start: 0, attackPeak: 0.1, relax:0.2, end: 0.3, locationBodyArm: "neutral", hand: "RIGHT", distance: 0.0251, srcContact:"HAND_PALMAR", shift:true } );
        this.newGesture( { type: "gesture", start: 0, attackPeak: 0.1, relax:0.2, end: 0.3, locationBodyArm: "neutral", hand: "LEFT",  distance: 0.0251, srcContact:"HAND_PALMAR", shift:true } );
        this.newGesture( { type: "gesture", start: 0, attackPeak: 0.1, relax:0.2, end: 0.3, handshape: "FLAT", mainBend: "ROUND", tco:0.5, thumbshape: "TOUCH", hand: "RIGHT", shift:true } );
        this.newGesture( { type: "gesture", start: 0, attackPeak: 0.1, relax:0.2, end: 0.3, handshape: "FLAT", mainBend: "ROUND", tco:0.75, thumbshape: "TOUCH", hand: "LEFT", shift:true } );
        this.newGesture( { type: "gesture", start: 0, attackPeak: 0.1, relax:0.2, end: 0.3, palmor: "l", hand: "RIGHT", shift: true } );
        this.newGesture( { type: "gesture", start: 0, attackPeak: 0.1, relax:0.2, end: 0.3, palmor: "r", hand: "LEFT", shift: true } );
        this.newGesture( { type: "gesture", start: 0, attackPeak: 0.1, relax:0.2, end: 0.3, extfidir: "dl", hand: "RIGHT", mode: "local", shift:true } );
        this.newGesture( { type: "gesture", start: 0, attackPeak: 0.1, relax:0.2, end: 0.3, extfidir: "dr", hand: "LEFT", mode: "local", shift:true } );
        this.newGesture( { type: "gesture", start: 0, attackPeak: 0.1, relax:0.2, end: 0.3, handConstellation: true, hand: "right", srcContact: "2_mid_palmar", secondSrcContact: "2_pad_palmar", dstContact:"hand_ulnar" } );

        this.update( 0.15 );
        this.left.loc.def.copy( this.left.locUpdatePoint ); // hack
        this.right.loc.def.copy( this.right.locUpdatePoint ); // hack
        this.update( 1 );
    }

    setDominantHand( isRightHandDominant ){
        if( isRightHandDominant ){ this.dominant = this.right; this.nonDominant = this.left; }
        else{ this.dominant = this.left; this.nonDominant = this.right; }
    }

    _updateLocationMotions( dt, arm ){
        let computeFlag = false;

        let motions = arm.locMotions;
        let resultOffset = arm.locUpdatePoint;
        resultOffset.set(0,0,0);

        // check if any motion is active and update it
        for ( let i = 0; i < motions.length; ++i ){
            if ( motions[i].transition ){
                computeFlag = true;
                resultOffset.add( motions[i].update( dt ) );
            }else{
                motions.splice(i, 1); // removed motion that has already ended
                i--;
            }
        }
        return computeFlag; 
    }

    _updateArm( dt, arm ){
        let bones = this.skeleton.bones;

        // reset shoulder, arm, elbow. This way location body, motion and location hand can be safely computed
        bones[ arm.loc.idx.shoulder ].quaternion.set(0,0,0,1);
        bones[ arm.loc.idx.arm ].quaternion.set(0,0,0,1);
        bones[ arm.loc.idx.elbow ].quaternion.set(0,0,0,1);

        // overwrite finger rotations
        arm.fingerplay.update(dt); // motion, prepare offsets
        arm.handshape.update( dt, arm.fingerplay.transition ? arm.fingerplay.curBends : null );
      
        // wrist point and twist
        arm.extfidirPalmor.update(dt);

        // wristmotion. ADD rotation to wrist
        arm.wristMotion.update(dt); // wrist - add rotation

        // backup the current wrist quaternion, before any arm rotation is applied
        arm._tempWristQuat.copy( arm.extfidirPalmor.wristBone.quaternion );

        // update arm posture world positions but do not commit results to the bones, yet.
        arm.loc.update( dt );
        let motionsRequireUpdated = this._updateLocationMotions( dt, arm );

        arm.elbowRaise.update( dt );
        arm.shoulderRaise.update( dt );
        arm.shoulderHunch.update( dt );

        arm.needsUpdate = motionsRequireUpdated | arm.fingerplay.transition | arm.handshape.transition | arm.wristMotion.transition | arm.extfidirPalmor.transition | arm.loc.transition | arm.elbowRaise.transition | arm.shoulderRaise.transition | arm.shoulderHunch.transition;
    }

    update( dt ){
        if ( !this.bodyMovement.transition && !this.right.needsUpdate && !this.left.needsUpdate && !this.handConstellation.transition ){ return; }

        this.bodyMovement.forceBindPose();

        this._updateArm( dt, this.right );
        this._updateArm( dt, this.left );
        
        if ( this.handConstellation.transition ){ 
            // 2 iks, one for body positioning and a second for hand constellation + motion
            // if only points in hand were used in handConstellation, the first ik could be removed. But forearm-elbow-upperarm locations require 2 iks

            // compute locBody and fix wrist quaternion (forearm twist correction should not be required. Disable it and do less computations)
            // using loc.cur.p, without the loc.cur.offset. Compute handConstellation with raw locBody
            this.right.ikSolver.reachTarget( this.right.loc.cur.p, this.right.elbowRaise.curValue, this.right.shoulderRaise.curValue, this.right.shoulderHunch.curValue, false ); //ik without aesthetics. Aesthetics might modify 
            this.left.ikSolver.reachTarget( this.left.loc.cur.p, this.left.elbowRaise.curValue, this.left.shoulderRaise.curValue, this.left.shoulderHunch.curValue, false );
            this._fixArmQuats( this.right, false );
            this._fixArmQuats( this.left, false );

            // handconstellation update, add motions and ik
            this.handConstellation.update( dt );
            this.right.locUpdatePoint.add( this.handConstellation.curOffsetR ); // HandConstellation + motions
            this.left.locUpdatePoint.add( this.handConstellation.curOffsetL ); // HandConstellation + motions
        }

        // if only location body and motions. Do only 1 ik per arm
        this.right.locUpdatePoint.add( this.right.loc.cur.p );
        this.right.locUpdatePoint.add( this.right.loc.cur.offset );
        this.right.ikSolver.reachTarget( this.right.locUpdatePoint, this.right.elbowRaise.curValue, this.right.shoulderRaise.curValue, this.right.shoulderHunch.curValue, true ); // ik + aesthetics

        this.left.locUpdatePoint.add( this.left.loc.cur.p );
        this.left.locUpdatePoint.add( this.left.loc.cur.offset );
        this.left.ikSolver.reachTarget( this.left.locUpdatePoint, this.left.elbowRaise.curValue, this.left.shoulderRaise.curValue, this.left.shoulderHunch.curValue, true ); // ik + aesthetics
    
        this._fixArmQuats( this.right, true );   
        this._fixArmQuats( this.left, true );  
        
        this.bodyMovement.update( dt );
    }


    /* TODO
        do not take into account bind quats
        Upperarm twist correction, forearm twist correction, wrist correction
    */
    _fixArmQuats( arm, fixForearm = false ){
        let q0 = this._tempQ_0;
        let q1 = this._tempQ_1;
        let bones = this.skeleton.bones;
        let fa = arm.extfidirPalmor.twistAxisForearm;       // forearm axis
        let fq = arm.extfidirPalmor.forearmBone.quaternion; // forearm quat
        let wa = arm.extfidirPalmor.twistAxisWrist;         // wrist axis
        let wq = arm.extfidirPalmor.wristBone.quaternion;   // wrist quat

        // --- Wrist ---
        // wrist did not know about arm quaternions. Compensate them
        q0.copy( bones[ arm.loc.idx.shoulder ].quaternion );
        q0.multiply( bones[ arm.loc.idx.arm ].quaternion );
        q0.multiply( bones[ arm.loc.idx.elbow ].quaternion );
        q0.invert();
        wq.copy( arm._tempWristQuat ).premultiply( q0 );  
        
        if ( !fixForearm ){ return } // whether to correct forearm twisting also

        // --- Forearm ---       
        let poseV = this._tempV3_0;   
        poseV.copy( arm.extfidirPalmor.elevationAxis );
        getTwistQuaternion( wq, wa, q0 );
        poseV.applyQuaternion( q0 ); // add current twisting
        getTwistQuaternion( arm.ikSolver.bindQuats.wrist, wa, q0 );
        poseV.applyQuaternion( q0.invert() ); // do not take into account possible bind twisting (could be removed if avatar is ensured to not have any twist in bind)

        // get angle, angle sign and ajust edge cases
        let angle = Math.acos( poseV.dot( arm.extfidirPalmor.elevationAxis ) );
        this._tempV3_1.crossVectors( arm.extfidirPalmor.elevationAxis, poseV );
        if ( this._tempV3_1.dot( arm.extfidirPalmor.twistAxisWrist ) < 0 ){ angle *= -1; }
        if ( arm == this.right && angle < -2.61 ){ angle = Math.PI*2 + angle; } // < -150
        if ( arm == this.left && angle > 2.61 ){ angle = -Math.PI*2 + angle; } // > 150
        
        // do not apply all twist to forearm as it may look bad on the elbow (assuming one-bone forearm)
        angle *= this.foreArmFactor;
        q0.setFromAxisAngle( fa, angle );
        fq.multiply( q0 ); // forearm
        wq.premultiply( q0.invert() ); // wrist did not know about this twist, undo it
    }

    _newGestureArm( bml, arm, symmetry = 0x00 ){
        if ( bml.locationBodyArm ){ // when location change, cut directed and circular motions
            // this.bodyMovement.forceBindPose();
            arm.loc.newGestureBML( bml, symmetry, arm.locUpdatePoint );
            arm.locMotions = [];
            this.handConstellation.cancelArm( arm == this.right ? 'R' : 'L' );
            // this.bodyMovement.forceLastFramePose();
        }
        if ( bml.motion ){
            let m = null;
            let str = typeof( bml.motion ) == "string" ? bml.motion.toUpperCase() : "";
            if ( str == "FINGERPLAY"){ m = arm.fingerplay; }
            else if ( str == "WRIST"){ m = arm.wristMotion; }
            else if ( str == "DIRECTED"){ m = new DirectedMotion(); arm.locMotions.push(m); }
            else if ( str == "CIRCULAR"){ m = new CircularMotion(); arm.locMotions.push(m); }
            
            if( m ){ 
                m.newGestureBML( bml, symmetry );
            }
        }
        if ( bml.palmor || bml.extfidir ){
            arm.extfidirPalmor.newGestureBML( bml, symmetry );
        }
        if ( bml.handshape ){
            arm.handshape.newGestureBML( bml, symmetry );
        } 
        if ( bml.hasOwnProperty( "shoulderRaise" ) ){
            arm.shoulderRaise.newGestureBML( bml, symmetry );
        }
        if ( bml.hasOwnProperty( "shoulderHunch" ) ){
            arm.shoulderHunch.newGestureBML( bml, symmetry );
        }
        if ( bml.hasOwnProperty( "elbowRaise" ) ){
            arm.elbowRaise.newGestureBML( bml, symmetry );
        }

        arm.needsUpdate = true;
    }

    /**
    * lrSym: (optional) bool - perform a symmetric movement. Symmetry will be applied to non-dominant hand only
    * udSym: (optional) bool - perform a symmetric movement. Symmetry will be applied to non-dominant hand only
    * ioSym: (optional) bool - perform a symmetric movement. Symmetry will be applied to non-dominant hand only
    * hand: (optional) "RIGHT", "LEFT", "BOTH". Default right
    * shift: (optional) bool - make this the default position. Motions not affected
    */
    newGesture( bml ){

        bml.start = bml.start || 0;
        bml.end = bml.end || bml.relax || bml.attackPeak || (bml.start + 1);
        bml.attackPeak = bml.attackPeak || ( ( bml.end - bml.start ) * 0.25 + bml.start );
        bml.relax = bml.relax || ( (bml.end - bml.attackPeak) * 0.5 + bml.attackPeak );

        // symmetry: bit0 = lr, bit1 = ud, bit2 = io
        let symmetryFlags = ( !!bml.lrSym );
        symmetryFlags |= ( ( !!bml.udSym ) << 1 );
        symmetryFlags |= ( ( !!bml.ioSym ) << 2 );

        if ( typeof( bml.hand ) == "string" ){ bml.hand = bml.hand.toUpperCase(); }
        
        if ( bml.config ){
            let c = bml.config;
            if ( c.dominant ){ this.setDominantHand( c.dominant == "RIGHT" ); }
            if ( c.handshapeBendRange ){ 
                this.left.handshape.setBendRange( handshapeBendRange );
                this.right.handshape.setBendRange( handshapeBendRange );
            }
            //...
        }

        if ( bml.handConstellation ){
            this.handConstellation.newGestureBML( bml, this.dominant == this.right ? 'R' : 'L' );
        }

        if ( bml.bodyMovement ){
            this.bodyMovement.newGestureBML( bml );
        }

        switch ( bml.hand ){
            case "RIGHT" :             
                this._newGestureArm( bml, this.right, ( this.dominant == this.right ) ? 0x00 : symmetryFlags ); 
                break;
            case "LEFT" : 
                this._newGestureArm( bml, this.left, ( this.dominant == this.left ) ? 0x00 : symmetryFlags ); 
                break;
            case "BOTH" : 
                this._newGestureArm( bml, this.dominant, 0x00 ); 
                this._newGestureArm( bml, this.nonDominant, symmetryFlags ); 
                break;
            case "NON_DOMINANT" : 
                this._newGestureArm( bml, this.nonDominant, symmetryFlags ); 
                break;
            case "DOMINANT": 
            default:
                this._newGestureArm( bml, this.dominant, 0x00 ); 
                break;
        }

    }


}


export { BodyController };