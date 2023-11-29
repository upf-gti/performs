import * as THREE from 'three';
import { stringToDirection } from './Utils.js';

class LocationBodyArm {
    constructor( config, skeleton, isLeftHand = false ) {
        this._tempV3_0 = new THREE.Vector3();
        this._tempV3_1 = new THREE.Vector3();
        this._tempV3_2 = new THREE.Vector3();
        
        this.skeleton = skeleton;
        this.config = config;
        this.bodyLocations = config.bodyLocations;
        this.handLocations = isLeftHand ? config.handLocationsL : config.handLocationsR;
        this.isLeftHand = !!isLeftHand;
        
        let boneMap = config.boneMap;
        let handName = isLeftHand ? "L" : "R";
        this.idx = {
            shoulder: boneMap[ handName + "Shoulder" ],
            arm: boneMap[ handName + "Arm" ],
            elbow: boneMap[ handName + "Elbow" ],
            wrist: boneMap[ handName + "Wrist" ]
        }
        
        // p : without offset. Raw location interpolation
        this.cur = { p: new THREE.Vector3(), offset: new THREE.Vector3() }; // { world point, elbow raise, offset due to previous motions+handconstellation }
        this.src = { p: new THREE.Vector3(), offset: new THREE.Vector3() }; // { world point, elbow raise, offset due to previous motions+handconstellation }
        this.trg = new THREE.Vector3();
        this.def = new THREE.Vector3();

        // if not null, this will be de point that tries to reach the target. Otherwise, the wrist is assumed
        this.contactFinger = null;
        this.keepUpdatingContact = false; // flag to enable constant update of target position. If disabled, contact is only updated during start-peak 
        this.contactUpdateDone = false; // internal flag to indicate final contact update into this.trg has been done. Always false when keepUpdatingContact == true

        this.time = 0; // current time of transition
        this.start = 0; 
        this.attackPeak = 0;
        this.relax = 0;
        this.end = 0;
        
        this.transition = false;

        
        this.worldArmSize = 0;
        this.skeleton.bones[ boneMap[ handName + "Arm" ] ].getWorldPosition( this._tempV3_0 );
        this.skeleton.bones[ boneMap[ handName + "Elbow" ] ].getWorldPosition( this._tempV3_1 );
        this.skeleton.bones[ boneMap[ handName + "Wrist" ] ].getWorldPosition( this._tempV3_2 );
        this.worldArmSize = this._tempV3_0.sub( this._tempV3_1 ).length() + this._tempV3_1.sub( this._tempV3_2 ).length();
        
        // set default poses
        this.reset();
    }

    reset(){
        this.transition = false;
        this.contactFinger = null;
        this.cur.p.set(0,0,0);
        this.def.set(0,0,0);

        this.keepUpdatingContact = false;
        this.contactUpdateDone = false;
    }

    update( dt ){
        // nothing to do
        if ( !this.transition ){ return; } 
        
        this.time += dt;
        
        // wait in same pose
        if ( this.time < this.start ){ 
            // this.cur.p.copy( this.src.p ); 
        }
        else if ( this.time >= this.end ){
            this.cur.p.copy( this.def );
            this.cur.offset.set(0,0,0); // just in case
            this.transition = false; // flag as "nothing to do"
        }
        else{
            let newTarget = this._tempV3_0.copy( this.trg );

            if ( this.contactFinger && !this.contactUpdateDone ){ // use some finger instead of the wrist
                this.contactFinger.updateWorldMatrix( true ); // self and parents
                
                this._tempV3_1.setFromMatrixPosition( this.contactFinger.matrixWorld );
                this._tempV3_2.setFromMatrixPosition( this.skeleton.bones[ this.idx.wrist ].matrixWorld );

                let dir = this._tempV3_1.sub( this._tempV3_2 );
                newTarget.sub( dir );

                // stop updating after peak, if keepUpdating is disabled. Hold last newTarget value as target
                if ( !this.keepUpdatingContact && this.time >= this.attackPeak ){
                    this.contactUpdateDone = true;
                    this.trg.copy( newTarget );
                }
            }
            
            
            // interpolations
            if ( this.time > this.attackPeak && this.time < this.relax ){ 
                this.cur.p.copy( newTarget );
                this.cur.offset.set(0,0,0);
            }            
            else if ( this.time <= this.attackPeak ){
                let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
                if ( t > 1){ t = 1; }
                t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;
    
                this.cur.offset.copy( this.src.offset ).multiplyScalar( 1 - t );
                this.cur.p.lerpVectors( this.src.p, newTarget, t );
                
                // overwriting newTarget ( aka this._tempV3_0 ). Add curve on the z axis (slightly better visually)
                let extraZSizeFactor = Math.min( 1, newTarget.sub( this.src.p ).lengthSq() / (this.worldArmSize * this.worldArmSize * 0.5) );
                let extraZsize = this.worldArmSize * 0.3 * extraZSizeFactor; // depending on how far the next objective
                this.cur.p.z += 2 * extraZsize * t * (1-t); // bezier simplified     [ 0 | size | 0 ]
            }    
            else if ( this.time >= this.relax ){
                let t = ( this.time - this.relax ) / ( this.end - this.relax );
                if ( t > 1){ t = 1; }
                t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;
    
                this.cur.offset.set(0,0,0);
                this.cur.p.lerpVectors( newTarget, this.def, t );

                // overwriting newTarget ( aka this._tempV3_0 ). Add curve on the z axis (slightly better visually)
                let extraZSizeFactor = Math.min( 1, newTarget.sub( this.def ).lengthSq() / (this.worldArmSize * this.worldArmSize * 0.5) );
                let extraZsize = this.worldArmSize * 0.3 * extraZSizeFactor; // depending on how far the next objective
                let extra =  2 * extraZsize * t * (1-t); // bezier simplified    [ 0 | size | 0 ]
                this.cur.p.z += extra;
            }
        }

    }


    // all second and main attributes do not get mixed until the end (jasigning)
    _newGestureLocationComposer( bml, symmetry, resultPos, isSecond = false ){
        let location = isSecond ? bml.secondLocationBodyArm : bml.locationBodyArm;

        // Symmetry should be only for sides
        // for symmetry - the left and right must be swapped
        // if ( ( symmetry & 0x01 ) && location ){ 
        //     if ( location[location.length-1] == "L" ){ location = location.slice(0, location.length-1) + "R"; } 
        //     else if( location[location.length-1] == "R" ){ location = location.slice(0, location.length-1) + "L"; } 
        // }
        if ( typeof( location ) != "string" ){ return false; }
        location = location.toUpperCase();

        if ( location == "EAR" || location == "EARLOBE" || location == "CHEEK" || location == "EYE" || location == "EYEBROW" || location == "SHOULDER" ){
            location += this.isLeftHand ? "_LEFT" : "_RIGHT";
        }
       
        let side = isSecond ? bml.secondSide : bml.side;
        if ( stringToDirection( side, this._tempV3_0, symmetry, true ) ){ // accumulate result and do not normalize
            // 0.5 and 1.5 to avoid rounding problems
            if ( this._tempV3_0.x < -1.5 ){ location += "_SideRR"; }
            else if ( this._tempV3_0.x < -0.5 ){ location += "_SideR"; }
            else if ( this._tempV3_0.x > 1.5 ){ location += "_SideLL"; }
            else if ( this._tempV3_0.x > 0.5 ){ location += "_SideL"; }
        }

        
        location = this.bodyLocations[ location ];
        if ( !location ){ return false; }
        location.getWorldPosition( resultPos );

        // TODO: expose distance modes? 
        // distance 
        let distance = isNaN( bml.distance ) ? 0 : bml.distance;
        distance += 0.05; // hack 
        
        if ( location.direction ){
            let m3 = ( new THREE.Matrix3() ).setFromMatrix4( location.matrixWorld );
            this._tempV3_0.copy( location.direction ).applyMatrix3( m3 ).normalize(); // from bone local space to world space direction 
        }else{
            // use avatar Z axis as distance
            this._tempV3_0.copy( this.config.axes[2] );
            // from mesh space to hips local space direction
            let m3 = ( new THREE.Matrix3() ).setFromMatrix4( this.skeleton.boneInverses[ this.config.boneMap.Hips ] );
            this._tempV3_0.applyMatrix3( m3 );
            // from hips local space to world space direction
            m3.setFromMatrix4( this.skeleton.bones[ this.config.boneMap.Hips ].matrixWorld );
            this._tempV3_0.applyMatrix3( m3 );
            this._tempV3_0.normalize();  
        }
        resultPos.addScaledVector( this._tempV3_0, this.worldArmSize * distance );
        
        return true;
    }
    /**
     * bml info
     * start, attackPeak, relax, end
     * locationBodyArm: string from bodyLocations
     * secondLocationBodyArm: (optional)
     * distance: (optional) [0,1] how far from the body to locate the hand. 0 = touch, 1 = arm extended (distance == arm size). 
     * side: (optional) rr, r, l, ll. If non-existant, defaults to center
     * secondSide: (optional)
     * 
     * displace: 26 directions
     * displaceDistance: metres
     * 
     * elbowRaise: (optional) in degrees. Positive values raise the elbow.
     * 
     * Following attributes describe which part of the hand will try to reach the locationBodyArm location 
     * srcContact: (optional) source contact location in a single variable. Strings must be concatenate as srcFinger + srcLocation + srcSide (whenever each variable is needed)
     * srcFinger: (optional) 1,2,3,4,5
     * srcLocation: (optional) string from handLocations (although no forearm, elbow, upperarm are valid inputs here)
     * srcSide: (optional) ULNAR, RADIAL, PALMAR, BACK. (ulnar == thumb side, radial == pinky side. Since hands are mirrored, this system is better than left/right)
     * keepUpdatingContact: (optional) once peak is reached, the location will be updated only if this is true. Default false
     *                  i.e: set to false; contact tip of index; reach destination. Afterwards, changing index finger state will not modify the location
     *                       set to true; contact tip of index; reach destination. Afterwards, changing index finger state (handshape) will make the location change depending on where the tip of the index is  
     * shift does not use contact locations
     */
    newGestureBML( bml, symmetry = 0x00, lastFrameWorldPosition = null ) {
        this.keepUpdatingContact = !!bml.keepUpdatingContact;
        this.contactUpdateDone = false;

        if ( !this._newGestureLocationComposer( bml, symmetry, this.trg, false ) ){
            console.warn( "Gesture: Location Arm no location found with name \"" + bml.locationBodyArm + "\"" );
            return false;
        };
        if( this._newGestureLocationComposer( bml, symmetry, this.src.p, true ) ){ // use src as temporal buffer
            this.trg.lerp( this.src.p, 0.5 );
        }

        // displacement
        if ( stringToDirection( bml.displace, this._tempV3_0, symmetry, true ) ){
            this._tempV3_0.normalize();
            let sideDist = parseFloat( bml.displaceDistance );
            sideDist = isNaN( sideDist ) ? 0 : sideDist;
            this.trg.x += this._tempV3_0.x * sideDist;
            this.trg.y += this._tempV3_0.y * sideDist;
            this.trg.z += this._tempV3_0.z * sideDist;
        }

        // source: Copy current arm state
        if ( lastFrameWorldPosition ){
            this.src.offset.subVectors( lastFrameWorldPosition, this.cur.p );
            this.src.p.copy( this.cur.p );
        }
        else{
            this.src.offset.copy( this.cur.offset );
            this.src.p.copy( this.cur.p );
        }
        
        // change arm's default pose if necesary
        if ( bml.shift ){
            this.def.copy( this.trg );
        }

        // in case the user selects a specific finger bone as end effector. Not affected by shift
        this.contactFinger = null;
        let srcFinger = parseInt( bml.srcFinger );
        let srcSide = bml.srcSide; 
        let srcLocation = bml.srcLocation;
        // check all-in-one variable first. Only hand locations allowed as contact
        
        let srcContact = typeof( bml.srcContact ) == "string" ? bml.srcContact.toUpperCase() : "";
        srcContact = this.handLocations[ srcContact ]; 
        if ( srcContact && !bml.srcContact.includes( "ARM" ) && !bml.srcContact.includes( "ELBOW" ) ){
            this.contactFinger = srcContact;
        }
        else if ( srcFinger || srcSide || srcLocation ){ 

            if ( isNaN( srcFinger ) || srcFinger < 1 || srcFinger > 5 ){ srcFinger = ""; }
            if ( typeof( srcLocation ) != "string" || srcLocation.length < 1){ srcLocation = ""; }
            else{ 
                srcLocation = ( srcFinger > 0 ? "_": "" ) + srcLocation.toUpperCase(); 
            }
            if ( typeof( srcSide ) != "string" || srcSide.length < 1 ){ srcSide = ""; }
            else{ 
                srcSide = "_" + srcSide.toUpperCase();
                if ( !isNaN( srcFinger ) ){ // jasigning...
                    if ( srcSide == "_RIGHT" ){ srcSide = "_" + (this.isLeftHand ? "RADIAL" : "ULNAR"); }
                    else if ( srcSide == "_LEFT" ){ srcSide = "_" + (this.isLeftHand ? "ULNAR" : "RADIAL"); }
                }
            }
            let srcName = srcFinger + srcLocation + srcSide; 
         
            // only hand locations allowed as contact
            if ( !srcName.includes( "ARM" ) && !srcName.includes( "ELBOW" ) ){
                this.contactFinger = this.handLocations[ srcName ];
            }
        }

        // check and set timings
        this.start = bml.start;
        this.attackPeak = bml.attackPeak;
        this.relax = bml.relax;
        this.end = bml.end;
        this.time = 0;
        this.transition = true;

        return true;
    }   
}


export { LocationBodyArm };