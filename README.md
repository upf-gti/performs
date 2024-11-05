# Performs

<img src="./data/imgs/performs.png" height="200" align="right">

Performs is designed to visualize and synthesize humanoid animations for customized avatars. It supports two types of animations: [**keyframe animations**](#keyframe-animation) (glTF, BVH) and [**script animations**](#script-animation) (SiGML, BML). The second mode integrates a variety of BML (Behavior Markup Language) instructions for Manual Features (MF) and Non-Manual Features (NMF) to create cohesive animations, performed in real-time. The project has made significant progress in synthesizing NMF, which is essential for enhancing the realism of sign language animations. This initiative began as part of the SignON project, a user-centric and community-driven effort aimed at facilitating communication among Deaf, hard of hearing, and hearing individuals across Europe.

![Alt Text](https://iili.io/2BeAGwb.gif)

The application allows users to customize the following features:
- Avatar:
    - [x] Character
    - [x] Color
- Background:
    - [x] Space: _Open space_, _Studio_, _Photocall_
    - [x] Color
    - [x] Photocall image
- Illumination:
    - [x] Light position
    - [x] Light color

It can be easily integrated into other applications by downloading the code or using it directly with an HTML iframe. For detailed instructions, please refer to the [Integration Guide](./docs/IntegrationGuide.md).


## Installation and Running
Clone the repository:
```
git clone https://github.com/upf-gti/performs.git
```
To run locally, host a server from the main project folder. You can also use the [build](./build/) version without GUI.
> [!IMPORTANT]  
> To load the default avatar, an internet connection is required. If you prefer to work offline, you can change the _modelToLoad_ in the _init()_ method of _App.js_. You can use the resources from the _/data_ folder or add your own.

You can load the customization features appending the URL params detailed in the [Integration Guide](./docs/IntegrationGuide.md) or loading a JSON file with the same params and calling _setConfiguration(settings)_ function from _App_ with the object data as a param.

## Adding avatars
> [!IMPORTANT]  
> Currently only **.gltf** and **.glb** are supported. If you happen to use another format, please convert it to the mentioned formats.

To add a new avatar to Performs, you must follow this steps:

 1. Make sure the avatar is rigged (if it is not rigged, we recommend using [Mixamo](https://www.mixamo.com)) 
 2. Check that your avatar has the correct scale and orientation.
 3. Use the [performs-atelier](https://github.com/upf-gti/performs-atelier) tool to configure all the parameters needed for the application (only required for Script mode), this will generate a configuration .json file containing all the needed information.
 4. Select `upload yours` in  the application _Avatars_ panel and select your files or your URLs.
 5. Change to your avatar in the panel. For a hosted file, you can load the avatar as default by adding the link to the _avatar_ parameter in the app's URL. See [Integration Guide](./docs/IntegrationGuide.md) to know the available parameters.

## Keyframe animation
This mode visualizes clip animations across different avatars. To ensure effective retargeting, certain options need to be adjusted for the _source_ animation and the _target_ avatar:
- _Embedded transforms_: Retargeting only takes into account the transforms from the actual bone objects (local transforms). If set to true, external (parent) transforms are computed and embedded into the root joint (only once, on construction). Afterwards, parent transforms/matrices can be safely modified and will not affect in retargeting. Useful when it is easier to modify the container of the skeleton rather than the actual skeleton in order to align source and target poses.
    - `true` or `false`
    
- _Reference pose mode_: Determines which pose will be used as the retargeting bind pose.
    - `DEFAULT`: Uses skeleton's actual bind pose
    - `CURRENT`: Uses skeleton's current pose
    - `TPOSE`: Forces the bind pose to be a T-pose and sets _CURRENT_ mode.

A detailed explanation of these options can be found in the [retargeting repository](https://github.com/upf-gti/retargeting-threejs/tree/main?tab=readme-ov-file#constructor).
> [!IMPORTANT]  
> Currently only **.gltf**, **.glb** and **.bvh** are supported. If you happen to use another format, please convert it to the mentioned formats.

## Script animation
This mode allows for the generation of procedural animations based on instructions. The system interprets the instructions based in **SiGML** (Signing Gesture Markup Language), and translates them into an extended version of BML (Behavior Markup Language), or directly into BML in **JSON** format. While the results may not match the quality of keyframe animations, this approach requires neither expensive equipment nor extensive manual labor, making it highly suitable for scalable sign synthesis. These instructions can be written manually or generated and exported using [Animics](https://webglstudio.org/projects/signon/animics)' script mode, which enables the creation and editing of this type of animation through a visual timeline-clip representation.

The current supported instructions are explained in detail in [BML Instructions](./docs/InstructionsBML.md).
An example:
``` javascript
{
    type: "faceLexeme",
    start: 0.1,
    attackPeak: 0.6,
    relax: 1.5,
    end: 1.8,
    amount: 0.1,
    lexeme: "NMF_ARCH"
}
```
### Examples
Some examples on simple NGT (Dutch Sign Language) 

Kind lezen boek (child reads a book):
![Alt Text](https://iili.io/2foQwCu.gif) 

Man rijden fiets (Man rides a bicycle) :
![Alt Text](https://iili.io/2foZgS4.gif)

### Architecture

The realizer is divided into main sections, each containing several files. 
The whole pipeline is warpped inside the _CharacterController_ class which is in charge of receiving a BML block and triggering and executing its instructions when required.

#### __Controllers section__

Files in this block: _CharacterController_, _FacialController_ and _BodyController_

- _CharacterController_: is the main entry. Everything is controlled from here. Every instance of FacialController, BodyController, BehaviourManager and BehaviourPlanner is automatically created and managed by this class.
Users only need to instantiated this class and call its functions:
    - _start_
    - _update_
    - _processMsg_: receives all the instructions of a block and triggers the whole pipeline to be synthesise the actions specified. 

- _FacialController_: manages the blending of the diferent animations involved in the face including facial gestures, eye movement and head displacement.

- _BodyController_: manages the blending of the diferent animations involved in the body including trunk, shoulders, arms, hands and fingers movement.

#### __BML section__

The files in this block: _BehaviourManager_, _BehavhourPlanner_ and _BehaviourRealizer_

- _BevahiourPlanner_: automatically generates some instructions such as blinking
- _BehaviourManager_: deals with all instruction blocks. Is in charge of triggering instructions when their time comes.
- _BehaviourRealizer_: a set of diverse functionalities to execute some particular instruction

## Collaborators
- Jaume Pozo [@japopra](https://github.com/japopra)  
- Víctor Ubieto [@victorubieto](https://github.com/victorubieto)
- Eva Valls [@evallsg](https://github.com/evallsg)
- Carolina del Corral [@carolinadcf](https://github.com/carolinadcf)
- Pablo García [@PZerua](https://github.com/PZerua)
- Alex Rodríguez [@jxarco](https://github.com/jxarco)

## Acknowledgments

- [Three.js](https://threejs.org/) - An open-source JavaScript library for creating interactive 3D and 2D graphics in web browsers.
- [Lexgui.js](https://github.com/jxarco/lexgui.js/) - A simple and lightweight GUI library for creating graphical user interfaces for web applications.

We would like to extend our gratitude to the creators and maintainers of these libraries for their invaluable contributions to the open-source community.

## Support

This project is being developed with partial financial support of:

| EMERALD Project (2023-2026) | SignON Project (2021-2023) |
| --- | --- |
| ![miciu](./data/imgs/marco_EMERALD.png) | ![logomaxr](./data/imgs/marco_SignON.png) |

