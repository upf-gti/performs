import * as THREE from 'three';
import { stringToDirection } from './Utils.js';

class HandConstellation {
    constructor( boneMap, skeleton, rightHandLocations, leftHandLocations ) {
        this.skeleton = skeleton;
        
        this.boneMap = boneMap;
       
       
        this.time = 0; // current time of transition
        this.start = 0; 
        this.attackPeak = 0;
        this.relax = 0;
        this.end = 0;
        
        this.transition = false;

        // assuming both arms are the same size approximately
        this.worldArmSize = 0;
        let v = new THREE.Vector3();
        let u = v.clone();
        let w = v.clone();
        this.skeleton.bones[ boneMap[ "RArm" ] ].getWorldPosition( v );
        this.skeleton.bones[ boneMap[ "RElbow" ] ].getWorldPosition( u );
        this.skeleton.bones[ boneMap[ "RWrist" ] ].getWorldPosition( w );
        this.worldArmSize = v.sub(u).length() + u.sub(w).length();


        this.handLocationsR = rightHandLocations;
        this.handLocationsL = leftHandLocations;

        this.prevOffsetL = new THREE.Vector3(); // in case a handconstellation enters before the previous one ends. Keep the old current offset
        this.prevOffsetR = new THREE.Vector3();
        this.curOffsetL = new THREE.Vector3(); // wrist position resulting from update
        this.curOffsetR = new THREE.Vector3(); // wrist position resulting form update

        // after reaching peak, user might choose to keep updating with real position or keep the peak value reached 
        this.keepUpdatingContact = false;
        this.peakOffsetL = new THREE.Vector3(0,0,0);
        this.peakOffsetR = new THREE.Vector3(0,0,0);
        this.peakUpdated = false;


        this.srcCurOffset = null; // pointer to curOffset L or R
        this.srcPoints = [null,null];
        this.dstCurOffset = null; // pointer to curOffset L or R
        this.dstPoints = [null,null];

        this.distanceVec = new THREE.Vector3(0,0,0);
        
        this.isBothHands = false; // whether to move only src hand to dst point or move both hands to their respective destination points 
        this.activeArmsFlag = 0x00; // 0x01 source active, 0x02 destination active (if both hands enabled, otherwise only 0x01 should be set)
        // set default poses
        this.reset();

        this._tempV3_0 = new THREE.Vector3();
        this._tempV3_1 = new THREE.Vector3();
        this._tempV3_2 = new THREE.Vector3();
    }

    reset(){
        this.transition = false;
        this.prevOffsetL.set(0,0,0);
        this.prevOffsetR.set(0,0,0);
        this.curOffsetL.set(0,0,0);
        this.curOffsetR.set(0,0,0);
        this.distanceVec.set(0,0,0);
        this.isBothHands = false;
        this.activeArmsFlag = 0x00;

        this.keepUpdatingContact = false;
        this.peakUpdated = false;
        this.peakOffsetL.set(0,0,0);
        this.peakOffsetR.set(0,0,0);
    }

    update( dt ){
        // nothing to do
        if ( !this.transition ){ return; } 

        this.time += dt;

        // wait in same pose
        if ( this.time < this.start ){ 
            return;
        }

        if ( this.keepUpdatingContact || !this.peakUpdated ){ 

            // compute source and target points 
            this.srcPoints[0].updateWorldMatrix( true ); // self and parents
            let srcWorldPoint = this._tempV3_0.setFromMatrixPosition( this.srcPoints[0].matrixWorld );
            if ( this.srcPoints[1] ){
                this.srcPoints[1].updateWorldMatrix( true ); // self and parents
                this._tempV3_2.setFromMatrixPosition( this.srcPoints[1].matrixWorld );  
                srcWorldPoint.lerp( this._tempV3_2, 0.5 );
            }
            this.dstPoints[0].updateWorldMatrix( true ); // self and parents
            let dstWorldPoint = this._tempV3_1.setFromMatrixPosition( this.dstPoints[0].matrixWorld );
            if ( this.dstPoints[1] ){
                this.dstPoints[1].updateWorldMatrix( true ); // self and parents
                this._tempV3_2.setFromMatrixPosition( this.dstPoints[1].matrixWorld );  
                dstWorldPoint.lerp( this._tempV3_2, 0.5 );
            }
            
            // compute offset for each hand
            if ( this.isBothHands ){
                if ( this.activeArmsFlag & 0x01 ){
                    this.srcCurOffset.lerpVectors( srcWorldPoint, dstWorldPoint, 0.5 );
                    this.srcCurOffset.sub( srcWorldPoint );
                    this.srcCurOffset.addScaledVector( this.distanceVec, 0.5 );
                }
                else{ this.srcCurOffset.set(0,0,0); }
                
                if ( this.activeArmsFlag & 0x02 ){
                    this.dstCurOffset.lerpVectors( dstWorldPoint, srcWorldPoint, 0.5 );
                    this.dstCurOffset.sub( dstWorldPoint );
                    this.dstCurOffset.addScaledVector( this.distanceVec, -0.5 ); // same as subScaledVector but this function does not exist
                }
                else{ this.dstCurOffset.set(0,0,0); }
            }else{
                this.srcCurOffset.copy( dstWorldPoint );
                this.srcCurOffset.sub( srcWorldPoint );
                this.srcCurOffset.add( this.distanceVec );
                this.dstCurOffset.set(0,0,0);
            }

            // does not need to keep updating. Set this src and dst as final positions and flag as peak updated
            if ( this.time > this.attackPeak && !this.keepUpdatingContact && !this.peakUpdated ){
                this.peakOffsetL.copy( this.curOffsetL );
                this.peakOffsetR.copy( this.curOffsetR );
                this.peakUpdated = true;
            }
        }

        // reminder: srcCurOffset and dstCurOffset are pointers to curOffsetL and curOffsetR
        // now that final points are computed, interpolate from origin to target
        let t = 0;
        if ( this.time <= this.attackPeak ){
            t = ( this.time - this.start ) / ( this.attackPeak - this.start );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            this.curOffsetL.lerpVectors( this.prevOffsetL, this.curOffsetL, t );
            this.curOffsetR.lerpVectors( this.prevOffsetR, this.curOffsetR, t );

        }    
        else if ( this.time > this.attackPeak && this.time < this.relax ){ 
            // t = 1;
            // nothing else to update
        }            
        else if ( this.time >= this.relax){
            t = ( this.end - this.time ) / ( this.end - this.relax );
            if ( t > 1 ){ t = 1; }
            if ( t < 0 ){ t = 0; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;
            
            if ( this.time >= this.end ){ this.transition = false; }

            if ( !this.keepUpdatingContact ){
                this.curOffsetL.copy( this.peakOffsetL );
                this.curOffsetR.copy( this.peakOffsetR );
            }
            this.curOffsetL.multiplyScalar( t );
            this.curOffsetR.multiplyScalar( t );

        }
        
    }

    cancelArm( arm = "R" ){
        if ( arm == "B" ){ this.activeArmsFlag = 0x00 }
        if ( arm == "R"){ 
            this.activeArmsFlag &= ( this.srcCurOffset == this.curOffsetR ) ? (~0x01) : (~0x02); 
            this.prevOffsetR.set(0,0,0); 
            this.curOffsetR.set(0,0,0); 
            this.peakOffsetR.set(0,0,0);
        }
        else if ( arm == "L"){ 
            this.activeArmsFlag &= ( this.srcCurOffset == this.curOffsetL ) ? (~0x01) : (~0x02); 
            this.prevOffsetL.set(0,0,0); 
            this.curOffsetL.set(0,0,0); 
            this.peakOffsetL.set(0,0,0);
        }

        if ( !this.activeArmsFlag ){ this.reset(); }
    }


    static handLocationComposer( bml, handLocations, isLeftHand = false, isSource = true, isSecond = false ){
        // check all-in-one variable first
        let compactContact;
        if ( isSource ){ compactContact = isSecond ? bml.secondSrcContact : bml.srcContact }
        else{ compactContact = isSecond ? bml.secondDstContact : bml.dstContact; }
        if ( typeof( compactContact ) == "string" ){
            compactContact = compactContact.toUpperCase();
            let result = handLocations[ compactContact ];
            if ( result ){ return result; }
        }

        // check decomposed variables
        let finger, side, location;
        if ( isSource ){ 
            if ( isSecond ){ finger = bml.secondSrcFinger; side = bml.secondSrcSide; location = bml.secondSrcLocation; } 
            else{ finger = bml.srcFinger; side = bml.srcSide; location = bml.srcLocation; } 
        }
        else{ 
            if ( isSecond ){ finger = bml.secondDstFinger; side = bml.secondDstSide; location = bml.secondDstLocation; } 
            else{ finger = bml.dstFinger; side = bml.dstSide; location = bml.dstLocation; } 
        }
        finger = parseInt( finger );
                

        if ( isNaN( finger ) || finger < 1 || finger > 5 ){ finger = ""; }
        if ( typeof( location ) != "string" || location.length < 1 ){ location = ""; }
        else{ 
            location = ( finger > 0 ? "_" : "" ) + location.toUpperCase();
        }
        if ( typeof( side ) != "string" || side.length < 1 ){ side = ""; }
        else{ 
            side = side.toUpperCase();
            if ( !location.includes("ELBOW") && !location.includes("UPPER_ARM") ){ // jasigning...
                if ( side == "RIGHT" ){ side = isLeftHand ?  "RADIAL" : "ULNAR" ; }
                else if ( side == "LEFT" ){ side = isLeftHand ? "ULNAR" : "RADIAL"; }
            }
            side = "_" + side;
        }
        let name = finger + location + side; 

        let result = handLocations[ name ];
        // if ( !result ){ result = handLocations[ "2_TIP" ]; }
        return result;
    }
    /**
     * bml info
     * start, attackPeak, relax, end
     * distance: [-ifinity,+ifninity] where 0 is touching and 1 is the arm size. Distance between endpoints. Right now only horizontal distance is applied
     * 
     * Location of the hand in the specified hand (or dominant hand)
     * srcContact: (optional) source contact location in a single variable. Strings must be concatenate as srcFinger + "_" +srcLocation + "_" +srcSide (whenever each variable is needed)
     * srcFinger: (optional) 1,2,3,4,5
     * srcLocation: (optional) string from handLocations (although no forearm, elbow, upperarm are valid inputs here)
     * srcSide: (optional) ULNAR, RADIAL, PALMAR, BACK. (ulnar == thumb side, radial == pinky side. Since hands are mirrored, this system is better than left/right)
     * 
     * Location of the hand in the unspecified hand (or non dominant hand)
     * dstContact: (optional) source contact location in a single variable. Strings must be concatenate as dstFinger + dstLocation + dstSide (whenever each variable is needed)
     * dstFinger: (optional) 1,2,3,4,5
     * dstLocation: (optional) string from handLocations (although no forearm, elbow, upperarm are valid inputs here)
     * dstSide: (optional) ULNAR, RADIAL, PALMAR, BACK 
     * 
     * keepUpdatingContact: (optional) once peak is reached, the location will be updated only if this is true. 
     *                  i.e: set to false; contact tip of index; reach destination. Afterwards, changing index finger state will not modify the location
     *                       set to true; contact tip of index; reach destination. Afterwards, changing index finger state (handshape) will make the location change depending on where the tip of the index is  

     */
    newGestureBML( bml, domHand = "R"  ) {
        this.keepUpdatingContact = !!bml.keepUpdatingContact;
        this.peakUpdated = false;
        let srcLocations = null;
        let dstLocations = null;
        let isLeftHandSource = false; // default right

        if ( bml.hand == "BOTH" ){ // src default to domhand
            this.isBothHands = true;
            this.activeArmsFlag = 0x03; // both source and destination arms are activated
            isLeftHandSource = domHand == "L";
        }else{
            this.isBothHands = false;
            this.activeArmsFlag = 0x01; // only source is activated
            if ( bml.hand == "RIGHT" ){ isLeftHandSource = false; }
            else if ( bml.hand == "LEFT" ){ isLeftHandSource = true; }
            else if ( bml.hand == "NON_DOMINANT" ){ isLeftHandSource = domHand == "R"; }
            else{ isLeftHandSource = domHand == "L"; }
        }

        // save current state as previous state. curOffset changes on each update
        this.prevOffsetL.copy( this.curOffsetL );
        this.prevOffsetR.copy( this.curOffsetR );


        // set pointers
        if ( isLeftHandSource ){
            this.srcCurOffset = this.curOffsetL;
            this.dstCurOffset = this.curOffsetR;
            srcLocations = this.handLocationsL; 
            dstLocations = this.handLocationsR;
        }else{
            this.srcCurOffset = this.curOffsetR;
            this.dstCurOffset = this.curOffsetL;
            srcLocations = this.handLocationsR;
            dstLocations = this.handLocationsL
        }
        this.srcPoints[0] = HandConstellation.handLocationComposer( bml, srcLocations, isLeftHandSource, true, false );
        this.srcPoints[1] = HandConstellation.handLocationComposer( bml, srcLocations, isLeftHandSource, true, true );
        this.dstPoints[0] = HandConstellation.handLocationComposer( bml, dstLocations, !isLeftHandSource, false, false ); 
        this.dstPoints[1] = HandConstellation.handLocationComposer( bml, dstLocations, !isLeftHandSource, false, true );
        if ( !this.srcPoints[0] ){ this.srcPoints[0] = srcLocations[ "2_TIP" ]; }
        if ( !this.dstPoints[0] ){ this.dstPoints[0] = dstLocations[ "2_TIP" ]; }
        
        let distance = parseFloat( bml.distance );
        if ( isNaN( distance ) ){ this.distanceVec.set(0,0,0); }
        else{ 
            if ( !stringToDirection( bml.distanceDirection, this.distanceVec, 0x00, true) ){
                if ( this.srcCurOffset == this.curOffsetR ){ this.distanceVec.set( -1,0,0 ); }
                else{ this.distanceVec.set( 1,0,0 ); }
            }
            this.distanceVec.normalize();
            this.distanceVec.multiplyScalar( distance * this.worldArmSize );
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


export { HandConstellation };