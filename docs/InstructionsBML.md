# BML Instructions
Data sent to processMsg

``` jsonc
{ 
    "type": "behaviours", 
    "composition": "MERGE", 
    "data": [ ... ] 
} 
```

Composition Types: 
``` jsonc
"composition": "MERGE" //default if not specified
"composition": "APPEND" // block will be added at the end of the list
"composition": "REPLACE" // removes overlapping blocks
```

Example of objects inside the  "data" array
``` jsonc
{
    "type": "faceLexeme",
    "start": 0.1,
    "attackPeak": 0.6,
    "relax": 1.5,
    "end": 1.8,
    "amount": 0.1,
    "lexeme": "NMF_ARCH"
}
```
The attribute ```shift``` indicates whether the action should be interpreted as the default pose to which return.

<br>

# Non Manual Features (NMF) 

## Blink
Blink is automatically executed by the realizer. However, a blink can be forced with this instruction. For a more controlled eyelid movement, use lexemes instead.
``` jsonc
{
    "type": "blink",
    "start": 0.1
}
```

---

## Eye Lookat
``` jsonc
{
    "type": "gaze", // other types: "gazeShift" - shift automatically set to true
    "start": 0.1,
    "ready": 0.2,
    "relax": 0.3,
    "end": 0.4,

    "influence": "NECK", // available values: [ "NECK", "HEAD", "EYES" ]
    "target": "UP_RIGHT", // available values: ["UP_RIGHT", "UP_LEFT", "DOWN_RIGHT", "DOWN_LEFT", "RIGHT", "LEFT", "UP", "DOWN", "FRONT" ]

    // optionals
    "offsetDirection": "UP_RIGHT", // available values: [ "UP_LEFT", "DOWN_RIGHT", "DOWN_LEFT", "RIGHT", "LEFT", "UP", "DOWN" ]
    "offsetAngle": 0, // degrees
    "headOnly": true, // whether to move the eyes with a head movement
    "shift": false
}
```

---

## Head NOD / SHAKE / TILT / FORWARD / BACKWARD
``` jsonc
{
    "type": "head",
	"start": 0.1,
	"ready": 0.2,         // gets to position to initiate head stroke
	"strokeStart": 0.3,   //optional, if not present, automatically set to ready
	"stroke": 0.4,        //optional, if not present, automatically set to half distance of strokeStart & strokeEnd
    "strokeEnd": 0.5,     //optional, if not present, automatically set to relax
	"relax": 0.6,         // starts returning to neutral position
	"end": 0.7,
    "amount": 1,  
	"repetition": 3,       //amount of times to REPEAT. Default 0 (meaning only moves once)

    "lexeme": "NOD", // available values: [ "NOD", "SHAKE", "TILT", "TILT_LEFT", "TILT_RIGHT", "TILT_FORWARD", "TILT_BACKWARD", "FORWARD", "BACKWARD" ]

}
```

---

## Speech
Mouthing.
``` jsonc
{
    "type": "speech",
    "start": 0,
    "text": "ApakAlIptIkAl", // "apocalyptical " arpabet 1-letter consonats and vowels plus "." and " "

    // optionals
    "phT": [0.1,0.2,0.3,...], // duration (seconds) of each phoneme. Overrides sentT.  
    "sentT": 2.3,  //duration (seconds) of whole sentence. Overrides speed. Delay not included.  
    "speed": 0.1, //phonemes per second of the whole string. Overrides default speed. Humans speak at 8 phonemes per second (lower boundary) 
    "phInt": [0.8,0.9,1,...], // intensity of each phoneme. Overrides sentInt.
    "sentInt": 1,
}
```

---

## Face Emotion
``` jsonc
{
    "type": "faceEmotion", // synonyms: "faceVA" 
    "start": 0.1,
    "attackPeak": 0.2, // reaches target/amount
    "relax": 0.3,  // starts undoing blink
    "end": 0.4, 

    // choose one: either "valaro" or "emotion"
    "valaro": [ 0.8, 0.6 ], // [ valence, arousal ] 
    "emotion": "HAPPINESS", // available values: ["HAPPINESS", "ANGER", "SADNESS", "SURPRISE", "FEAR", "DISGUST", "CONTEMPT" ]

    // optionals
    "amount": 1,
    "shift": false,
}
```

---

## Face Lexeme
``` jsonc
{
    "type": "face", // synonyms: [ ]"faceLexeme", "faceFACS" ],  other types: "faceShift" - shift automatically set to true
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4, 

	"lexeme": "BROW_RAISER", // string or array of objects such as [ { "lexeme": "BROW_RAISER" }, { "lexeme": "BLINK", "amount": 2 } ]. The latter, uses the amount defined outside for BROW_RAISER, and amount=2 for BLINK
    // optionals
    "amount": 1, // defaults to 1
}
```
<details>
<summary>Click to view the complete list of available lexemes</summary>

ARCH                      
BROW_LOWERER                      
BROW_LOWERER_LEFT                      
BROW_LOWERER_RIGHT                      
BROW_RAISER                      
BROW_RAISER_LEFT                      
BROW_RAISER_RIGHT                      
INNER_BROW_RAISER                      
OUTER_BROW_RAISER                      
SQUINT                      
BLINK                      
EYES_CLOSED                      
UPPER_LID_RAISER                      
UPPER_LID_RAISER_LEFT                      
UPPER_LID_RAISER_RIGHT                      
LID_TIGHTENER                      
WINK_LEFT                      
WINK_RIGHT                      
CHEEK_RAISER                      
CHEEK_SUCK                      
CHEEK_SUCK_LEFT                      
CHEEK_SUCK_RIGHT                      
CHEEK_BLOW                      
CHEEK_BLOW_LEFT                      
CHEEK_BLOW_RIGHT                      
NOSE_WRINKLER                      
NOSTRIL_DILATOR                      
NOSTRIL_COMPRESSOR                      
LIP_CORNER_DEPRESSOR                      
LIP_CORNER_DEPRESSOR_LEFT                      
LIP_CORNER_DEPRESSOR_RIGHT                      
LIP_CORNER_PULLER                      
LIP_CORNER_PULLER_LEFT                      
LIP_CORNER_PULLER_RIGHT                      
LIP_STRETCHER                      
LIP_FUNNELER                      
LIP_TIGHTENER                      
LIP_PUCKERER                      
LIP_PUCKERER_LEFT                      
LIP_PUCKERER_RIGHT                      
LIP_PRESSOR                      
LIPS_PART                      
LIP_SUCK                      
LIP_SUCK_UPPER                      
LIP_SUCK_LOWER                      
LOWER_LIP_DEPRESSOR                      
LOWER_LIP_DEPRESSOR_LEFT                      
LOWER_LIP_DEPRESSOR_RIGHT                      
UPPER_LIP_RAISER                      
UPPER_LIP_RAISER_LEFT                      
UPPER_LIP_RAISER_RIGHT                      
CHIN_RAISER                      
DIMPLER                      
DIMPLER_LEFT                      
DIMPLER_RIGHT                      
LIP_BITE                      
SMILE_TEETH                      
SMILE_TEETH_WIDE                      
SMILE_CLOSED                      
ROUND_OPEN                      
ROUND_CLOSED                      
MOUTH_STRETCH                      
CLOSE_TIGHT                      
JAW_DROP                      
JAW_THRUST                      
JAW_SIDEWAYS_LEFT                      
JAW_SIDEWAYS_RIGHT                      
TONGUE_BULGE_LEFT                      
TONGUE_BULGE_RIGHT                      
TONGUE_UP                      
TONGUE_SHOW                      
TONGUE_WIDE                      
LIP_WIPE                      
NECK_TIGHTENER                      
</details>


<br>

<br>

# Manual Features (MF)

```
6 main directions
U=up, D=down, L=left, R=right, I=in, O=out, 
```

Most gestures share some optional attributes 
``` jsonc
{
    "hand": "RIGHT", // available values: [ "RIGHT", "LEFT", "BOTH", "DOMINANT", "NON_DOMINANT" ] - hand to apply gesture (it does NOT become the dominant hand). Defaults to "RIGHT". Defaults to dominant hand
    "lrSym": true,  // bool, left-right symmetry. Only applied to the non-dominant hand
    "udSym": false, // bool, up-down  symmetry. Only applied to the non-dominant hand
    "ioSym": false, // bool, in-out  symmetry. Only applied to the non-dominant hand
}
```

The dominant hand can be set through the following attribute.
``` jsonc
{
    "type": "gesture",
    "config": { 
        "dominant": "RIGHT", // available values: ["RIGHT", "LEFT" ] - which hand is considered dominant. Only needs to be set once. Affects symmetry attributes. Defaults to "right". 
        "handshapeBendRange": 4, // finger bends can be specified with integer numbers. These are normalized between 0 and 1. This variable defines the maximum value to reach 1. JASigning works with a range of 4 (only integers from 0 to 4 can be inputed, being 0 a straight finger and 4 the maximum bend) 
    },
}
```

Attributes with the ```second``` prefix are usually optional and combines the effects of this and the same attribute without the prefix.

All gesture intructions can be packed into a single BML instruction. Caution must be taken as attributes may overlap between different gesture types. This can be useful to to reuse the same timing for several gestures  
The following example using a single BML, instructs the avatar the handshape, palmor, extfidir and the shoulder raise with the same timing variables
``` jsonc
{ 
    "type": "gesture",
    "start": 0,   "attackPeak": 0.5,   "relax": 1,   "end": 2, 
    "shoulderRaise": "1",
    "extfidir": "U", 
    "palmor": "L",  
    "handshape": "FINGER_2",
    "hand": "LEFT" 
}
```

## Elbow Raise
Raises the elbow (added to the elbow raise automatically computed while moving the arm)
``` jsonc
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,

    "elbowRaise": 1, // number [-1,1], where 0 = 0 degrees and 1 = 90 degrees

    //optional
    "shift": false, 
}
```

---
## Shoulder Raise
Raises the shoulder (added to the shoulder raise automatically computed while moving the arm)
``` jsonc
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,
    
    "shoulderRaise": 0.8, // value [-1,1], where 0 = 0 degrees and 1 = 30 degrees
    
    //optional
    "shift": false, 
}
```

---
## Shoulder Hunch
Moves the shoulder forward (added to the shoulder hunch automatically computed while moving the arm)
``` jsonc
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,
    
    "shoulderHunch": 0.8, // value [-1,1], where 0 = 0 degrees and 1 = 30 degrees.
    
    //optional
    "shift": false, 
}
```

---
## Body Movement
Moves the body (trunk). Tilt forward-backward, tilt left-right and rotate left-right. New gestures are added to the previuos one, they are not replaced.
``` jsonc
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,
    
    "bodyMovement": "TILT_FORWARD", // available valuse: [ "TILT_FORWARD", "TILT_BACKWARD", "TILT_LEFT", "TILT_RIGHT", "ROTATE_LEFT", "ROTATE_RIGHT" ]
    
    //optional
    "amount": 0.5, // default to 1 
}
```

---
## Body Location
Moves the arm (wrist) to a location of the body (face + trunk).
``` jsonc
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,
    
    "locationBodyArm": "CHEST", // string
   
    // optionals
    "secondLocationBodyArm": "CHEST", // string
    "side": "RR", // available values: ["RR", "R", "L", "LL"]. string, chooses a point to the right, slightly right, slightly left or left of the chosen point
    "secondSide": "L", // string

    "distance": 0, // [0,1] how far from the body to locate the hand. 0 = close, 1 = arm extended
    "displace": "U", // string, combination of the 6 directions. Location will be offseted into that direction
    "displaceDistance": 0.05, // number how far to move to the indicated side. Metres 

    //Following attributes describe which part of the hand will try to reach the locationBodyArm location 
    "srcFinger": "1", // 1,2,3,4,5, see handconstellation for more information
    "srcLocation": "PAD", // see handconstellation hand locations
    "srcSide": "PALMAR", // see handconstellation sides
    "keepUpdatingContact": false, // once peak is reached, the location will be updated only if this is true. Defaults to false
                // i.e.: set to false; contact tip of index; reach destination. Afterwards, changing index finger state will not modify the location
                // i.e.: set to true; contact tip of index; reach destination. Afterwards, changing index finger state (handshape) will make the location change depending on where the tip of the index is  

    "shift": false, // contact information ( srcFinger, srcLocation, srcSide ) is not kept for shift

    "lrSym":false, // symmetry applied to sides and displace
    "udSym":false,
    "ioSym":false
}
```
<details>
<summary>Click to view the complete list of available locations</summary>

"HEAD"               
"HEAD_TOP"    
"FOREHEAD"    
"EYEBROWS_LINE"                     
"EYEBROW" ``` // automatically assigns right or left from the incoming hand ```                    
"EYEBROW_RIGHT"               
"EYEBROW_LEFT"                       
"EYES_LINE"                    
"EYE" ``` // automatically assigns right or left from the incoming hand ```                    
"EYE_RIGHT"               
"EYE_LEFT"        
"EAR"  ``` // automatically assigns right or left from the incoming hand ```                    
"EAR_RIGHT"               
"EAR_LEFT"    
"EARLOBE" ``` // automatically assigns right or left from the incoming hand ```                    
"EARLOBE_RIGHT"     
"EARLOBE_LEFT"               
"CHEEK"  ``` // automatically assigns right or left from the incoming hand ```                    
"CHEEK_RIGHT"               
"CHEEK_LEFT"        
"NOSE"               
"BELOW_NOSE"               
"MOUTH"               
"CHIN"               
"UNDER_CHIN"               
"NECK"                       
"CHEST"               
"SHOULDER_TOP"          
"SHOULDER_LINE"          
"SHOULDER" ``` // automatically assigns right or left from the incoming hand ```                    
"SHOULDER_RIGHT"               
"SHOULDER_LEFT"        
"STOMACH"               
"BELOW_STOMACH"               
"NEUTRAL"               
</details>

---

## Hand Orientation
Yaw, Pitch and Twist of the wrist joint.
``` jsonc
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,

    "extfidir": "L", // string, yaw and pitch of hand. Combination of 6 directions    
    "palmor": "U", //string, twist of hand. Combination of 4 directions ( "I", "O" are ignored )
    
    // optionals
    "secondExtfidir": "L", // string, combination of 6 directions. Will compute midpoint between extifidir and secondExtfidir  
    "secondPalmor": "L", // string, combinatino of 4 directions ( "I", "O" not valid ). Will compute midpoint between palmor and secondPalmor.
    "shift": false, 

    "lrSym":false, // symmetry applied palmor and extfidir
    "udSym":false,
    "ioSym":false
}
```

---
## Handshape
Sets the posture of the fingers of a hand. Fingers are numbered from 1 (thumb) to 5 (pinky)
``` jsonc
{ 
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,
    
    "handshape": "FLAT", //string from the handshape table
    
    // optionals
    "secondHandshape": "FLAT", //string from the handshape table
    "thumbshape": "TOUCH", //string from thumbshape table. if not present, the predefined thumbshape for the handshape will be used
    "secondThumbshape": "TOUCH", // string from thumbshape table. Applied to secondHandshape
    "tco": 0.3, // number [0,1]. Thumb Combination Opening from the Hamnosys specification 
    "secondtco": 0.3, // number [0,1]. Thumb Combination Opening from the Hamnosys specification. Applied to secondHandshape
    
    "mainBend": "HOOKED", // bend applied to selected fingers from the default handshapes. Basic handshapes and ThumbCombination handshapes behave differently. Value from the bend table
    "secondMainBend": "HOOKED", // mainbend applied to secondHandshape
    "bend2": "044", // overrides any other bend applied by this handshape for the index finger
    "bend3": "044", // overrides any other bend applied by this handshape for the middle finger 
    "bend4": "044", // overrides any other bend applied by this handshape for the ring finger
    "bend5": "044", // overrides any other bend applied by this handshape for the pinky finger

    "mainSplay": 0.5, // number [-1,1]. Separates laterally fingers 2,4,5. Splay diminishes the more the finger is bent
    "splay2": 0.5, // number [-1,1]. Sepparates laterally the index finger. Splay diminishes the more the finger is bent. 
    "splay3": 0.5, // number [-1,1]. Sepparates laterally the middle finger. Splay diminishes the more the finger is bent. 
    "splay4": 0.5, // number [-1,1]. Sepparates laterally the ring finger. Splay diminishes the more the finger is bent. 
    "splay5": 0.5, // number [-1,1]. Sepparates laterally the pinky finger. Splay diminishes the more the finger is bent. 

    "specialFingers": "5", //string of numbers [2-5], the main characteristics of the handshape are applied to the fingers specified. This is done before the mainbend and the thumbshape since they are applied to the selected fingers, and these change when applying specialFingers.

    "thumbTarget": "2_TIP", // where the thumb should go to. Accepts hand locations in compact format "fingerDigit_location_side". E.G. "HAND_PALMAR", "2_BASE_PALMAR", "4_TIP" 
    "thumbDistance": 0, // optional - thumb contact status with respect to target. Distance mesured in whole thumb size. Direction perpendicular to hand palm. Defaults to 0
    "thumbSource": "PAD", // optional - either "TIP" or "PAD". Which part of the thumb should move to target. Defaults to tip.
    "thumbSplay": 0, // optional - sepparates base of thumb without changing target.

    "shift": false,
}
```
<details>
<summary>Click to view the complete list of available HANDSHAPES</summary>

--- BASIC HANDSHAPES ---                       
FIST               
FINGER_2               
FINGER_23               
FINGER_23_SPREAD               
FINGER_2345               
FLAT            
               
--- THUMB COMBINATION HANDSHAPES ---               
PINCH_12               
PINCH_12_OPEN               
PINCH_ALL               
CEE_ALL               
CEE_12               
CEE_12_OPEN               
</details>

<details>
<summary>Click to view the complete list of available THUMBSHAPES </summary>

DEFAULT   
OUT    
OPPOSED    
ACROSS    
TOUCH                   
</details>
<details>
<summary>Click to view the complete list of BEND STATES </summary>

STRAIGHT         
HALF_BENT         
BENT         
ROUND         
HOOKED         
DOUBLE_BENT                 
DOUBLE_HOOKED         
triplets of numbers from 0-9. The first number indicates the base of the finger, the second the middle joint and the third the joint in the tip of the finger.         
i.e. BENT = "900", HOOKED = "099"
</details>

---

## Hand Constellation
Moves the hand position with respect to each other.

The motion is stopped if an arm location is executed afterwards.
``` jsonc
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,

    "handConstellation": true,
    //Location of the hand in the specified hand (or dominant hand). Attributes should only be included if necessary
    "srcFinger": "2", // 1,2,3,4,5. If the location does not use a finger, do not include this
    "srcLocation": "PAD", // string from hand locations (although no forearm, elbow, upperarm are valid inputs here)
    "srcSide": "BACK", // ULNAR, RADIAL, PALMAR, BACK. The location "TIP" does not need any side and the attribute should not be included

    //Location of the hand in the unspecified hand (or non dominant hand). Attributes should only be included if necessary
    "dstFinger": "2", // 1,2,3,4,5. If the location does not use a finger, do not include this
    "dstLocation": "BASE", // string from hand locations or arm locations
    "dstSide": "PALMAR", // ULNAR, RADIAL, PALMAR, BACK. The location "TIP" does not need any side and the attribute should not be included
    
    "hand": "DOMINANT", // if hand=="BOTH", both hand will try to reach each other, meeting in the middle. Otherwise, only the specified hand will move towards the unspecified hand.

    // optionals
    // second attributes. The middle point is computed between the second attributes and their main counterparts.
    "secondSrcFinger":   "2",
    "secondSrcLocation": "MID",
    "secondSrcSide":     "BACK",
    "secondDstFinger":   "2",
    "secondDstLocation": "PAD",
    "secondDstSide":     "BACK",

    "distance": 0, //[-ifinity,+ifninity] where 0 is touching and 1 is the arm size. Distance between endpoints. 
    "distanceDirection": "L", // string, combination of 6 directions. If not provided, defaults to horizontal outwards direction
    
    "keepUpdatingContact": false, // once peak is reached, the location will be updated only if this is true. Defaults to false
                    // i.e.: set to false; contact tip of index; reach destination. Afterwards, changing index finger state will not modify the location
                    // i.e.: set to true; contact tip of index; reach destination. Afterwards, changing index finger state (handshape) will make the location change depending on where the tip of the index is  
}
```
<details>
<summary>Click to view the complete list of HAND CONSTELLATION SIDES </summary>

RIGHT         
LEFT         
ULNAR         
RADIAL         
FRONT  ``` // only for ELBOW and UPPER_ARM instead of PALMAR ```      
BACK         
PALMAR
</details>
<details>
<summary>Click to view the complete list of HAND LOCATIONS </summary>

TIP  ``` // need a finger specification and does not have sides ```        
PAD ``` // need a finger specification ```        
MID ``` // need a finger specification ```         
BASE ``` // need a finger specification ```         
THUMB_BALL         
HAND         
WRIST         
</details>
<details>
<summary>Click to view the complete list of ARM LOCATIONS </summary>

FOREARM        
ELBOW        
UPPER_ARM         
</details>

---
## Directed Motion
Moves the arm (wrist) in a linear direction.

``distance`` and ``curveSize`` attributes are concurrent and not exclusive. Meaning one attribute can be 0 while the other different from 0.

The motion is stopped if an arm location is executed afterwards.
``` jsonc
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,

    "motion": "DIRECTED",
    "direction": "O", // string, combination of 6 directions
    
    // optionals
    "secondDirection": "L", // string, combination of 6 directions. Will compute midpoint between direction and secondDirection.
    "distance": 0.05, // number, metres of the displacement. Default 0.2 m (20 cm)
    "curve": "U", // string, combination of 6 directions.  Default to none
    "secondCurve": "L", // string, combination of 6 directions. Will compute midpoint between curve and secondCurve.
    "curveSize": 1, // number meaning the amplitude of the curve
    "zigzag": "L", // string, combination of 6 directions
    "zigzagSize": 0.05, // amplitude of zigzag (from highest to lowest point) in metres. Default 0.01 m (1 cm)
    "zigzagSpeed": 3, // oscillations per second. Default 2

    "lrSym":false,
    "udSym":false,
    "ioSym":false
}
```

---
## Circular Motion
Moves the arm (wrist) in a circular motion.

The motion is stopped if an arm location is executed afterwards.
``` jsonc
{
    "type": "gesture",
    "start": 0.1,
    "end": 0.4,
    
    "motion": "CIRCULAR",
    "direction": "O", // string, combination of 6 directions. Axis of rotation
    
    // optionals
    "secondDirection": "L", // string, combination of 6 directions. Will compute midpoint between direction and secondDirection.
    "distance": 0.05, // number, radius in metres of the circle. Default 0.05 m (5 cm)
    "startAngle": 0, // where in the circle to start. 0º indicates up. Indicated in degrees. Default to 0º. [-infinity, +infinity]
    "endAngle": 360, // where in the circle to finish. 0º indicates up. Indicated in degrees. Default to 360º. [-infinity, +infinity]
    "ellipseAxisDirection": "ul", // string, direction of the major axis of the ellipse if the direction were set as 'O' (out). 'I' and 'O' are ignored. If unspecified, defaults to 'L'. 
    "ellipseAxisRatio": 0.5, // number. Sets the ellipse axes ratio minor/major, where 1 is a circle with radius "distance". If unspecified, defaults to 1. 
    "zigzag": "L", // string, combination of 6 directions
    "zigzagSize": 0.05, // amplitude of zigzag (from highest to lowest point) in metres. Default 0.01 m (1 cm)
    "zigzagSpeed": 3, // oscillations per second. Default 2

    "lrSym":false,
    "udSym":false,
    "ioSym":false
}
```

---
## Fingerplay Motion
Wiggle fingers of the hand.
``` jsonc
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,
    
    "motion": "FINGERPLAY",

    // optionals
    "speed": 2, // oscillations per second. Default 3
    "intensity": 0.5, //[0,1]. Default 0.3
    "fingers": "13", // string with numbers. Each number present activates a finger. 2=index, 3=middle, 4=ring, 4=pinky. I.E. "234" activates index, middle, ring but not pinky. Default all enabled
    "exemptedFingers": "2", //string with numbers. Blocks a finger from doing the finger play. Default all fingers move

}
```


---
## Wrist Motion
Repetitive swinging, nodding and twisting of wrist (wiggle for the wrist).
``` jsonc
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,
    
    "motion": "WRIST",
    "mode": "NOD",
    /* either a: 
        - string from [ "NOD", "SWING", "TWIST", "STIR_CW", "STIR_CCW", "ALL" ]
        - or a value from [ 0 = None, 1 = TWIST, 2 = NOD, SWING = 4 ]. 
    Several values can co-occur by using the OR (|) operator. I.E. ( 2 | 4 ) = STIR_CW
    Several values can co-occur by summing the values. I.E. ( 2 + 4 ) = STIR_CW
    */

    // optionals
    "speed": 3, // oscillations per second. Negative values accepted. Default 3. 
    "intensity": 0.3, // [0,1]. Default 0.3
}
```

